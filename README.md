# Thymer Form Input View

Thymer app plugin for adding a form-based custom view to collections.

The plugin installs a collection bootstrap and a collection-specific custom view named `Create $collection_name`. The form creates records. Visible form fields come from the custom view's `field_ids`, so field visibility is managed through the normal Thymer view settings.

## Installation

1. Create a global Thymer app plugin in `Plugins -> Create Plugin`.
2. Paste `plugin.json` into the `Configuration` tab.
3. Paste `plugin.js` into the `Custom Code` tab.
4. Paste `plugin.css` into the `Custom CSS` tab.
5. Save the plugin.
6. Run `Install Form Input View in Collections` from the command palette.
7. Open each collection's `Create $collection_name` custom view settings and choose the visible fields.

Collections need a collection plugin context for custom views. The installer adds a minimal bootstrap when needed.

For a collection with existing custom code, call the shared runtime from `onLoad`:

```js
class Plugin extends CollectionPlugin {
  onLoad() {
    const boot = (attemptsLeft = 20) => {
      const registry = window.ThymerFormInputView;
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

Global defaults live in `plugin.json` under `custom.formInputView`.

Supported options:

- `viewId`: ID of the form input view. Default: `form_input`.
- `viewLabel`: label used when registering the custom view. Default: `Create $collection_name`.
- `viewIcon`: icon used when creating the view config. Default: `ti-plus`.
- `submitLabel`: submit button label. Default: `Create`.
- `useViewFields`: use the form input view's `field_ids`. Default: `true`.
- `allowInlineChoices`: allow new choice values from form input. Default: `true`.
- `fieldIds`: explicit field list used when `useViewFields` is false or the view has no `field_ids`.
- `defaults`: default property values applied after record creation.

Default value tokens:

- `timestamp`: local timestamp formatted as `YYYY-MM-DD HHmm`.
- `collectionName`: current collection name.
- `collectionGuid`: current collection GUID.
- `blank`: empty value.

## Behavior

- The form uses active, editable fields only.
- The form field list comes from the custom view's visible field settings.
- Single choice fields use a datalist input with existing values and optional inline value creation.
- Multi-value fields use comma or newline separated text.
- Created and modified timestamps are left to Thymer.
