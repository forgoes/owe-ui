# owe-ui

## Purpose

This is the customer-facing chat frontend for the OWE lead qualification assistant.

## Runtime

The app expects a backend URL through:

- `NEXT_PUBLIC_API_BASE_URL`

## Container

A production Docker image can be built from [`Dockerfile`](/Users/jayden/workspace/github/owe/owe-ui/Dockerfile).

The Next.js app is built in standalone mode and served with:

```bash
node server.js
```

## Release Flow

This repository includes a tag-driven GitHub Actions workflow at
[`/.github/workflows/release.yml`](/Users/jayden/workspace/github/owe/owe-ui/.github/workflows/release.yml).

When a tag like `v0.1.0` is pushed, the workflow:

1. runs lint and build
2. builds a Docker image
3. pushes it to GHCR
4. updates the staging Helm values in `owe-devops`
