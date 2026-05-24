# Thymer Form Input View

Thymer plugin for adding a `Create` custom view to collections. The view renderes a form for record creation.

The plugin installs a collection bootstrap and a `Create` custom view. Visible form fields come from the custom view's `field_ids`, so field visibility is managed through the normal Thymer view settings.

## Installation

1. Create a global Thymer app plugin in Plugins -> Create Plugin
1. Paste `plugin.json` into the `Configuration` tab.
1. Paste `plugin.js` into the `Custom Code` tab.
1. Save the plugin.

The plugin requires a small configuration snippet in a collection to enable the form.

Paste the following into the desired collection under Collection Settings -> Edit as Code -> Custom Code tab.

```js
class Plugin extends CollectionPlugin {
  onLoad() {
    const boot = (attemptsLeft = 20) => {
      const registry = window.ThymerCreateViewType;
      if (registry && typeof registry.bootstrap === "function") {
        registry.bootstrap(this);
        return;
      }
      if (attemptsLeft > 0) setTimeout(() => boot(attemptsLeft - 1), 100);
    };

    boot();
  }
}
```

To also maintain timestamp titles for newly created untitled records:

```js
registry.bootstrap(this, { timestampUntitledTitles: true });
```

## Configuration

Collections need a collection plugin context for custom views. The installer adds a minimal bootstrap when needed.

## Collection Bootstrap

For a collection with existing custom code, call the shared runtime from `onLoad`:


## Configuration

Global defaults live in `plugin.json` under `custom.createView`.

Supported options:

- `viewId`: ID of the Create view. Default: `create`.
- `viewLabel`: label used when registering the custom view. Default: `Create`.
- `viewIcon`: icon used when creating the view config. Default: `ti-plus`.
- `submitLabel`: submit button label. Default: `Create`.
- `useViewFields`: use the Create view's `field_ids`. Default: `true`.
- `allowInlineChoices`: allow new choice values from form input. Default: `true`.
- `hiddenFields`: fallback hidden fields when no view `field_ids` are configured.
- `defaults`: default property values applied after record creation.

Default value tokens:

- `timestamp`: local timestamp formatted as `YYYY-MM-DD HHmm`.
- `collectionName`: current collection name.
- `collectionGuid`: current collection GUID.
- `blank`: empty value.

## Behavior

- The form uses active, editable fields only.
- If the Create view has visible fields configured, those fields define the form.
- If no visible fields are configured, `hiddenFields` is used as a fallback.
- Single choice fields use a datalist input with existing values and optional inline value creation.
- Multi-value fields use comma or newline separated text.
- Created and modified timestamps are left to Thymer.
