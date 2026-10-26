# ZeugDB repository

This repository stores the data synchronized by the ZeugDB app.

## Required layout

- `assets/<asset-id>.asset` — one asset per file.
- `types/<type-id>.type` — type and field definitions.
- `components/<component-id>.comp` — reusable structured blocks such as inspection records.
- `fotos/<asset-id>/` — photo files managed through Git LFS.
- `locations/<location-id>.location` — points, rooms, and cable routes.

The app creates and updates asset and location files during **Sync**. Type
definitions are also synchronized; adding or deleting a type in the app is
included in the next sync. `README.md` files in the data directories keep the
directories available in a fresh Git repository. No database or server-side
application is required.

## Connect the app

Open **Einstellungen**, use the repository URL shown there, and configure a
Gitea username and personal access token with repository read/write permission.
Clone the repository once. After that, the app works offline and sends local
changes to this repository when synchronized.

## Electrical equipment

The starter type set includes office, commercial-kitchen, and grounds/
maintenance equipment. All electrical device types inherit common nameplate
and inventory fields plus a repeatable DGUV V3 inspection record. Add one
`pruefung` block for every inspection so the history is not overwritten.

For each device, assign a nameplate image and an overview image in the asset's
photo section. The app uploads the images through Git LFS and stores their
roles and paths in the asset file.

Do not commit access tokens or passwords to this repository.
