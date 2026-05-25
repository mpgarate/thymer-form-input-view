# Thymer Form Input View

Thymer app plugin for adding a form-based custom view to collections.

The plugin provides a form-based custom view renderer. A collection opts in with a small bootstrap in its Custom Code, where it can name the custom view; after that, add the matching custom view through the collection's view settings. The form creates records, and visible form fields come from that view's `field_ids`.

## Installation

1. Create a global Thymer app plugin in `Plugins -> Create Plugin`.
2. Paste `plugin.json` into the `Configuration` tab.
3. Paste `plugin.js` into the `Custom Code` tab.
4. Paste `plugin.css` into the `Custom CSS` tab.
5. Save the plugin.
6. For each collection that should offer the view type, add the bootstrap below in its Custom Code.
7. Add the custom view matching `viewLabel` to that collection and choose its visible fields.

Collections need a collection plugin context for custom views. The global plugin does not automatically update collection code or view configuration.

For a collection with existing custom code, call the shared runtime from `onLoad`:

```js
class Plugin extends CollectionPlugin {
  onLoad() {
    const boot = (attemptsLeft = 20) => {
      const registry = window.ThymerFormInputView;
      if (registry && typeof registry.bootstrap === "function") {
        registry.bootstrap(this, { viewLabel: "Form: $collection_name" });
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
registry.bootstrap(this, {
  viewLabel: "Form: $collection_name",
  timestampUntitledTitles: true,
});
```

## Configuration

Global defaults live in `plugin.json` under `custom.formInputView`.

Supported options:

- `viewLabel`: name registered for the collection custom view. Supports `$collection_name`; default: `Form: $collection_name`.
- `submitLabel`: submit button label. Default: `Create`.
- `useViewFields`: use the configured custom view's `field_ids`. Default: `true`.
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
- The form field list comes from the configured custom view's visible field settings.
- Single choice fields use a datalist input with existing values and optional inline value creation.
- Multi-value fields use comma or newline separated text.
- Created and modified timestamps are left to Thymer.
