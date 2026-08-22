# DigitalOcean Deployment Plan

## Principle

Start with the minimum sensible production/staging footprint and scale without application rearchitecture.

All compute must use Docker images and configuration/secrets supplied externally.
No compute node contains irreplaceable local state.

## What to purchase first

### Development

Nothing mandatory in DigitalOcean.
Use local Docker for PostgreSQL/Valkey during early phases.

### First shared staging environment

Purchase:

1. **1 Basic Droplet — 2 vCPU / 4 GiB RAM**
   - web + realtime + worker can initially share this staging machine
   - Ubuntu 24.04 LTS
   - Docker
   - private VPC

2. **Managed PostgreSQL — 1 GiB / 1 vCPU initially**
   - staging only
   - upgrade to 2–4 GiB when needed

3. **Managed Valkey — 1 GiB**
   - staging only

Optional: 4. **Spaces Object Storage**

- backups/exports/static artifacts

Do not buy a load balancer for a single staging node.

## Initial paid production footprint

Recommended minimum:

### Compute

- **Web/API + WebSocket Droplet:** Basic 2 vCPU / 4 GiB
- **Simulation/worker Droplet:** Basic 4 vCPU / 8 GiB

Keep services separately deployable even if initially colocated.

### Data

- **Managed PostgreSQL:** 2 vCPU / 4 GiB
- **Managed Valkey:** 2 GiB / 1 vCPU
- **Spaces:** one subscription/bucket group

### Networking

- one DigitalOcean VPC
- Cloudflare in front for DNS/TLS/security
- a DigitalOcean Regional HTTP Load Balancer becomes necessary when web/realtime compute is duplicated; do not buy it before there are at least two backend nodes unless high availability is required immediately.

## Current public price reference — August 2026

DigitalOcean Basic Droplets:

- 2 vCPU / 4 GiB: $24/month
- 4 vCPU / 8 GiB: $48/month

Managed PostgreSQL:

- 1 GiB / 1 vCPU: about $15.15/month
- 2 GiB / 1 vCPU: about $30.45/month
- 4 GiB / 2 vCPU: about $60.90/month

Managed Valkey:

- 1 GiB / 1 vCPU: $15/month
- 2 GiB / 1 vCPU: $30/month
- HA requires additional matching node(s).

Regional HTTP Load Balancer:

- starts at $12/month per node.

Spaces:

- $5/month base, including 250 GiB storage and 1 TiB outbound transfer.

Always re-check current prices at purchase time.

## Approximate initial production infrastructure

Without HA:

- web/realtime Droplet: $24
- simulator/worker Droplet: $48
- PostgreSQL 4 GiB: ~$60.90
- Valkey 2 GiB: $30
- Spaces: $5

Approximate total: **$167.90/month**, before backups/monitoring/Cloudflare paid services/market data.

With a load balancer after adding a second frontend/realtime node:

- ~$12/month.

## Scale-up path

### Need more web/WS capacity

Add an identical web/realtime Droplet and register it with the load balancer.

### Need more simulation capacity

Add simulation workers. They use the same image and join Valkey work streams/queues automatically.

### Need more DB CPU/RAM

Resize the managed PostgreSQL plan.

### Need more DB storage

Increase managed PostgreSQL storage without application code changes.

### Need more Valkey capacity

Resize the managed cluster; move to HA before production criticality justifies it.

### Need more object storage

Spaces scales independently.

## Terraform requirements

Terraform must manage:

- project
- VPC
- Droplets
- tags
- firewall
- load balancer (feature flag)
- Spaces where practical
- database resources where provider support permits
- DNS only if deliberately controlled in DigitalOcean

Terraform variables:

- environment
- region
- web_node_count
- web_size
- worker_node_count
- worker_size
- postgres_size
- valkey_size
- load_balancer_enabled

Example desired workflow:

```text
worker_node_count = 2
→ terraform apply
→ new nodes bootstrap
→ pull current image
→ connect to Valkey/Postgres
→ automatically begin claiming work
```

## Server bootstrap

Ubuntu 24.04 LTS:

- create non-root deploy user
- SSH keys only
- disable password SSH
- disable direct root SSH
- firewall
- automatic security updates
- Docker Engine + Compose plugin
- time synchronization
- log rotation
- monitoring agent
- Docker registry login through scoped credential
- no application secrets stored in Git

## Backup requirements

- managed PostgreSQL automated backups
- periodic logical backup/export to Spaces
- restore test documented and run
- no assumption that Valkey is permanent storage
- infrastructure repo + container registry are sufficient to rebuild compute

## Production upgrade before large launch

Before approaching thousands of simultaneous users:

- duplicate web/realtime nodes
- enable load balancer
- split WebSocket gateway if useful
- multiple simulator workers
- PostgreSQL connection pooling
- Valkey HA
- synthetic load testing
- failover/recovery tests
