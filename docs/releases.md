# Stackray Releases

Stackray uses release-please, checked-in semantic versions, and GitHub Releases as the public release source of truth.

## Version Sources

- `package.json` owns the package version.
- `.release-please-manifest.json` stores the current release-please version state.
- `lib/version.ts` exposes the same version to the app UI and server update checks. Release-please updates it through the `x-release-please-version` annotation.

Do not tag releases by hand for normal work. A tag without a GitHub Release is intentionally ignored by deployed apps.

## Release Please Flow

1. Normal feature and fix PRs merge to `main`.
2. `.github/workflows/release-please.yml` runs on each push to `main`.
3. release-please reads Conventional Commit messages since the last release.
4. If there are releasable changes, it opens or updates a release PR with the version bump and generated release notes.
5. As more releasable commits merge, release-please updates the same release PR.
6. When maintainers are ready to release, merge the release PR.
7. release-please creates the `vX.Y.Z` tag and GitHub Release.

Normal feature, fix, scanner pin, and catalog PRs should not manually bump the Stackray version.

## Version Bump Rules

Stackray release commits should follow Conventional Commits. When PRs are squash-merged, use a Conventional Commit PR title:

- `fix: correct Railway update copy` creates a patch release.
- `feat: add CSV export` creates a minor release.
- `feat!: change scan result API shape` or a `BREAKING CHANGE:` footer creates a breaking release.

Because Stackray is still pre-1.0, `release-please-config.json` sets `bump-minor-pre-major` so breaking changes advance the minor version instead of jumping directly to `1.0.0`.

## Scanner Pin Updates

The scheduled scanner pin workflow refreshes `httpx`, `nuclei`, `subfinder`, and nuclei-template pins without changing the Stackray app version. Its automation PR uses a `fix(scanner): ...` title so release-please can include the scanner update in the pending release PR, but the update is not published until maintainers merge that release PR.

This keeps self-hosted deployments from seeing update banners for every automated scanner dependency update before a structured Stackray release exists.

## Deployed Update Checks

Admin users see an update banner when their deployed `APP_VERSION` is older than the latest GitHub Release from `STACKRAY_RELEASE_REPOSITORY`, which defaults to `CarlosCommits/stackray`.

`STACKRAY_GITHUB_TOKEN` is optional for public repositories. Set it for private release repositories or to increase GitHub API rate limits.
