import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminUserDirectory } from '@/server/queries';

import {
  setManagedUserRoleAction,
  transitionManagedUserStatusAction,
} from '../actions';

const notices: Record<string, { error?: boolean; message: string }> = {
  'invalid-operation': {
    error: true,
    message: 'That user change is not allowed from the current account state.',
  },
  'operation-failed': {
    error: true,
    message: 'The operation failed without changing authoritative state.',
  },
  'role-updated': { message: 'Operational role updated and audited.' },
  'status-updated': {
    message: 'Account status transition recorded and audited.',
  },
};

function userName(user: {
  displayName: string | null;
  email: string;
  name: string | null;
}): string {
  return user.displayName?.trim() || user.name?.trim() || user.email;
}

export default async function SuperadminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; search?: string }>;
}) {
  await requireSuperadmin();
  const params = await searchParams;
  const directory = await getSuperadminUserDirectory(params.search ?? '');
  const notice =
    params.notice === undefined ? undefined : notices[params.notice];

  return (
    <section className="superadmin-section">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Identity operations</p>
          <h1>Users</h1>
        </div>
        <p>
          Review account verification, activity, entry and payment counts. You
          can grant or remove operational admin access and transition non-owner
          accounts without deleting their audit history.
        </p>
      </header>

      {notice === undefined ? null : (
        <p
          className={`notice-banner${notice.error === true ? ' notice-error' : ''}`}
          role="status"
        >
          {notice.message}
        </p>
      )}

      <form className="superadmin-search" method="get">
        <label>
          Find by email or name
          <input
            defaultValue={directory.normalizedSearch}
            name="search"
            placeholder="name@example.com"
          />
        </label>
        <button type="submit">Search</button>
        <span>
          {directory.total} matching account{directory.total === 1 ? '' : 's'}
        </span>
      </form>

      <section className="superadmin-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Authoritative member ledger</p>
            <h2>Recent members</h2>
          </div>
          <p>Showing up to 100 newest matching accounts.</p>
        </div>
        {directory.members.length === 0 ? (
          <p className="empty-copy">No matching user accounts.</p>
        ) : (
          <div className="superadmin-record-list">
            {directory.members.map((member) => {
              const protectedOwner = member.role === 'SUPERADMIN';
              return (
                <article
                  className="superadmin-record superadmin-user-record"
                  key={member.id}
                >
                  <header>
                    <div>
                      <span
                        className={`status-pill status-${member.status.toLowerCase()}`}
                      >
                        {member.status.toLowerCase()}
                      </span>
                      <h3>{userName(member)}</h3>
                      <code>{member.email}</code>
                    </div>
                    <dl className="superadmin-record-meta">
                      <div>
                        <dt>Role</dt>
                        <dd>{member.role}</dd>
                      </div>
                      <div>
                        <dt>Entries</dt>
                        <dd>{member._count.entries}</dd>
                      </div>
                      <div>
                        <dt>Payments</dt>
                        <dd>{member._count.payments}</dd>
                      </div>
                    </dl>
                  </header>
                  <p className="superadmin-record-note">
                    Registered{' '}
                    {member.createdAt
                      .toISOString()
                      .replace('T', ' ')
                      .slice(0, 16)}{' '}
                    UTC ·{' '}
                    {member.emailVerified === null
                      ? 'email unverified'
                      : 'email verified'}
                  </p>
                  {protectedOwner ? (
                    <p className="superadmin-record-note">
                      Superadmin accounts are protected from role and status
                      changes in the browser control center.
                    </p>
                  ) : (
                    <div className="superadmin-inline-actions superadmin-user-actions">
                      <form action={setManagedUserRoleAction}>
                        <input name="userId" type="hidden" value={member.id} />
                        <input
                          name="role"
                          type="hidden"
                          value={member.role === 'ADMIN' ? 'TRADER' : 'ADMIN'}
                        />
                        <button type="submit">
                          {member.role === 'ADMIN'
                            ? 'Remove admin access'
                            : 'Grant admin access'}
                        </button>
                      </form>
                      {member.status === 'ACTIVE' ? (
                        <form
                          action={transitionManagedUserStatusAction}
                          className="superadmin-danger-form"
                        >
                          <input
                            name="userId"
                            type="hidden"
                            value={member.id}
                          />
                          <input
                            name="status"
                            type="hidden"
                            value="SUSPENDED"
                          />
                          <input
                            aria-label={`Suspension reason for ${member.email}`}
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Suspension reason"
                            required
                          />
                          <button type="submit">Suspend account</button>
                        </form>
                      ) : null}
                      {member.status === 'SUSPENDED' ? (
                        <>
                          <form action={transitionManagedUserStatusAction}>
                            <input
                              name="userId"
                              type="hidden"
                              value={member.id}
                            />
                            <input name="status" type="hidden" value="ACTIVE" />
                            <input
                              aria-label={`Restore reason for ${member.email}`}
                              maxLength={1000}
                              minLength={3}
                              name="reason"
                              placeholder="Restoration reason"
                              required
                            />
                            <button type="submit">Restore account</button>
                          </form>
                          <form
                            action={transitionManagedUserStatusAction}
                            className="superadmin-danger-form"
                          >
                            <input
                              name="userId"
                              type="hidden"
                              value={member.id}
                            />
                            <input name="status" type="hidden" value="CLOSED" />
                            <input
                              aria-label={`Closure reason for ${member.email}`}
                              maxLength={1000}
                              minLength={3}
                              name="reason"
                              placeholder="Closure reason"
                              required
                            />
                            <button type="submit">Close account</button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
