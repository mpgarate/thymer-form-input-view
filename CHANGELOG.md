# Changelog

## 0.3.0 - 2026-05-24

- Changed default view label to `Create $collection_name`.
- Removed duplicate legacy Create/Form Input views during live deployment.
- Added installer cleanup for old Create/Form Input view labels.
- Preserved custom view field order when rendering form inputs.

## 0.2.0 - 2026-05-24

- Renamed plugin and runtime identifiers to Form Input View.
- Removed the hidden-field fallback; visible fields now come from the view configuration.

## 0.1.0 - 2026-05-24

- Initial repository version.
- Added shared Thymer app plugin for `Form Input` custom views.
- Added installer command for collection bootstraps and Form Input view configs.
- Added form rendering from custom view `field_ids`.
- Added inline creation for choice values.
- Added configurable default values.
