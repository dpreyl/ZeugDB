# Assets

The app stores one asset per UTF-8 `.asset` file, named
`<asset-id>.asset`. Files are created and updated by the app during Sync.

Electrical-device records use a descriptive `bezeichnung`, a type selected
from `types/`, and a hierarchical location. Repeated DGUV V3 inspections are
stored as `pruefung[n].<field>` block entries, preserving the history.

The reserved `foto_typenschild` and `foto_uebersicht` fields point to the
assigned device photos. Photo files are stored with the app's Git-LFS flow;
the `.asset` file contains references, not embedded image data.
