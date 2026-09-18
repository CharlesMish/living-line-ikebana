# Garden — keep, revisit, begin again

Garden is the first repeatable creative loop: arrange → step back → choose to
keep → revisit or start another bowl. Stopping is a decision, not a score.
It is a collection of arrangements, not yet a plant-growing simulation, shop,
mission system, or school curriculum.

## Use it

1. Place and shape one or more cuttings. Step Back to choose a view.
2. Open **Garden**. Opening cancels an unfinished gesture before reading any state.
3. Optionally name the moment and select **Keep this bowl**. The committed graphs,
   cut history, camera pose and a small actual-view thumbnail are saved together.
   Keeping does not clear the working bowl. A missing thumbnail does not prevent
   keeping the arrangement.
4. Open a card to view it in 3D. Orbit, Pan, zoom and presets are available. Editing
   requires **Make a working copy**. **Return to my bowl** restores the working
   coordinator, its camera and selection. Looking never overwrites it.
5. **Start a fresh bowl** and **Make a working copy** offer Keep first / Replace
   without keeping / Cancel when the working bowl contains material. Copying
   leaves the Garden original intact. Replacement saves before changing memory;
   if saving fails, the existing working bowl stays available.

**Download backup** exports all Garden entries, including graph history and
thumbnails. **Import backup** merges compatible entries without replacing the
working bowl. Reimporting an identical backup adds nothing. Conflicting identities,
unsupported generators, invalid graphs, oversized files and malformed entries
reject the entire import. No partial recovery or silent substitution occurs.

An entry can be removed after an explicit confirmation. Download a backup before
removing an entry you may want again; removal has no built-in undo.

## Persistence boundaries

- Working autosave remains `ikebana-web-alpha:studio-v1`, `storageVersion: 1`.
- Garden is `ikebana-web-alpha:garden-v1`, `gardenVersion: 1`. It has at most 24
  entries and a 1,800,000-character JSON limit. The browser's shared quota may be
  reached earlier. No automatic eviction of kept arrangements occurs.
- A snapshot has canonical plants, successful insertion ordinal and a camera
  pose. It excludes previews, pending cuttings, pointer state and renderer objects.
- Plant identity is scoped to an arrangement. Copies preserve it. Ordinary player
  bowl replacement retains the larger current/snapshot insertion ordinal, so a
  subsequent seat cannot reuse an existing plant ID. An empty fresh bowl retains
  that ordinal. No generator is rerun during Keep, View, Copy or Import.
- Garden mutation checks that storage still matches the last loaded collection.
  A stale tab must close and reopen Garden before writing. This is an optimistic
  check, not a cross-tab locking protocol; the working autosave remains single-tab.
- Incompatible/corrupt Garden storage stays untouched and can still be downloaded
  for recovery. Keeping/importing are disabled until readable data is available.
- Reload always restores the working bowl, never a temporary Garden viewer.
  Working autosave still does not store camera framing; Garden entries do.
- Data lives in this browser/origin. A downloaded standalone file, GitHub Pages,
  localhost, private browsing and another device can have separate storage.
  Browser data clearing can remove both collections and drafts. Export backups.
- Current Garden dialogs require a browser with native HTML dialog support
  (Safari 15.4 or later; current Chrome/Firefox). No account or network service is
  required. There is no cloud sync.

## Verification and phone pass

Automated tests cover pruned-history round trips, isolation from later mutation,
quota failure, stale writers, invalid data, all-or-nothing backup merging,
cancellation before Keep, read-only viewing, safe copy/fresh replacement,
insertion identity and reload through the unchanged working-save format.

Physical phone observations are still required:

- Keep a mixed bowl with a title; confirm thumbnail matches the chosen view.
- View it, orbit/pan, then return. The original working bowl and view should return.
- Make a copy, prune it, reload, and view the original. The original is unchanged.
- Start fresh: Cancel, then Keep first. Reopen both saved arrangements.
- Export, import the same file (no duplicates), then import on another origin.
- Try 320px portrait, short landscape and enlarged text. All modal actions must
  remain reachable by scrolling; no controls belong beneath the plant.
- Use keyboard Tab/Shift-Tab and Escape. Dialog focus must stay contained and return
  to the opener. Kept arrangements must not expose Arrange or material editing.
- Open Garden with a second pointer during bend/insert preview. Releasing the first
  pointer afterward must do nothing. Repeat with orientation/background changes.

The September 18 implementation was typechecked and tested in the repository.
Cloud Browser could not access the local preview (`ERR_BLOCKED_BY_CLIENT`), so no
browser visual pass or physical-phone signoff is claimed for this version.
