# Typen

The app stores one type definition per UTF-8 `.type` file, named
`<type-id>.type`. The app reads these files when cloning or pulling and
synchronizes type edits on the next Sync.

`_base.type` contains shared/base field definitions. A specific type can refer
to it with `extends: _base`.
