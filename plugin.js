class Plugin extends AppPlugin {
  onLoad() {
    this.installRuntime();
    this.ui.addCommandPaletteCommand({
      label: "Install Form Input View in Collections",
      icon: "ti-plus",
      onSelected: () => this.installInAllCollections(true),
    });

    if (this.getConfiguration().custom?.auto_install !== false) {
      setTimeout(() => this.installInAllCollections(false), 1000);
      this.events.on("collection.created", () => setTimeout(() => this.installInAllCollections(false), 1000));
    }
  }

  installRuntime() {
    const appPlugin = this;
    const text = (value) => String(value || "").trim();
    const labelOf = (field) => field.label || field.name || field.id;
    const split = (value) => String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "choice";
    const lc = (value) => text(value).toLowerCase();

    const merge = (...items) => {
      const result = {};
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        for (const [key, value] of Object.entries(item)) {
          result[key] = value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
            ? merge(result[key], value)
            : value;
        }
      }
      return result;
    };

    const globalOptions = () => {
      const custom = appPlugin.getConfiguration().custom || {};
      return custom.formInputView || custom.form_input_view || {};
    };

    const collectionOptions = (collectionPlugin) => {
      const custom = collectionPlugin.getConfiguration().custom || {};
      return custom.formInputView || custom.form_input_view || {};
    };

    const normalizeOptions = (collectionPlugin, options = {}) => {
      const supplied = options.formInputView || options.form_input_view || options;
      return merge(globalOptions(), collectionOptions(collectionPlugin), supplied);
    };

    const listOpt = (options, camel, snake) => {
      const value = options[camel] || options[snake] || [];
      return Array.isArray(value) ? value : split(value);
    };

    const mapOpt = (options, camel, snake) => {
      const value = options[camel] || options[snake] || {};
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    };

    const findFormInputView = (collectionPlugin, options) => {
      const views = collectionPlugin.getConfiguration().views || [];
      const viewId = lc(options.viewId || options.view_id || "form_input");
      const viewLabel = lc(resolveLabel(collectionPlugin, options));
      return views.find((view) => lc(view.id) === viewId)
        || views.find((view) => lc(view.label) === viewLabel && view.type === "custom")
        || views.find((view) => lc(view.label) === viewLabel);
    };

    const resolveLabel = (collectionPlugin, options) => {
      const template = options.viewLabel || options.view_label || "Create $collection_name";
      const collectionName = collectionPlugin.getName ? collectionPlugin.getName() : collectionPlugin.getConfiguration().name;
      return String(template)
        .replaceAll("$collection_name", collectionName)
        .replaceAll("${collection_name}", collectionName)
        .replaceAll("{collection_name}", collectionName)
        .replaceAll("$collectionName", collectionName)
        .replaceAll("${collectionName}", collectionName)
        .replaceAll("{collectionName}", collectionName);
    };

    const getFormFields = (collectionPlugin, options) => {
      const view = options.useViewFields === false || options.use_view_fields === false ? null : findFormInputView(collectionPlugin, options);
      const viewFieldIds = Array.isArray(view?.field_ids) ? view.field_ids : [];
      const explicit = viewFieldIds.length ? viewFieldIds : listOpt(options, "fieldIds", "field_ids");
      const fields = (collectionPlugin.getConfiguration().fields || []).filter((field) => field.active !== false && !field.read_only);

      if (!explicit.length) return fields;

      const fieldsByKey = new Map();
      fields.forEach((field) => {
        fieldsByKey.set(lc(field.id), field);
        fieldsByKey.set(lc(labelOf(field)), field);
      });

      const seen = new Set();
      return explicit.map((key) => fieldsByKey.get(lc(key))).filter((field) => {
        if (!field || seen.has(field.id)) return false;
        seen.add(field.id);
        return true;
      });
    };

    const formatTimestamp = (date) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date).replace(":", "");
    };

    const findChoice = (field, value) => {
      const normalized = lc(value);
      return (field.choices || []).find((choice) => lc(choice.id) === normalized || lc(choice.label) === normalized) || null;
    };

    const saveConfig = async (collectionPlugin, config) => {
      if (typeof collectionPlugin.saveConfiguration === "function") return await collectionPlugin.saveConfiguration(config);
      if (typeof collectionPlugin.savePlugin === "function") return await collectionPlugin.savePlugin(config, collectionPlugin.getJavaScript ? collectionPlugin.getJavaScript() : null);
      return false;
    };

    const ensureChoice = async (collectionPlugin, field, value, options) => {
      const label = text(value);
      if (!label || findChoice(field, label)) return findChoice(field, label);
      if (options.allowInlineChoices === false || options.allow_inline_choices === false) return null;

      const config = collectionPlugin.getConfiguration();
      const configField = (config.fields || []).find((item) => item.id === field.id || labelOf(item) === labelOf(field));
      if (!configField) return null;

      configField.choices = configField.choices || [];
      const usedIds = new Set(configField.choices.map((choice) => choice.id));
      let id = slug(label);
      let suffix = 2;
      while (usedIds.has(id)) id = `${slug(label)}_${suffix++}`;

      const choice = { id, label, icon: "", color: String(configField.choices.length % 15), active: true };
      configField.choices.push(choice);
      await saveConfig(collectionPlugin, config);
      field.choices = configField.choices;
      return choice;
    };

    const setChoice = async (collectionPlugin, prop, field, value, options) => {
      if (Array.isArray(value)) {
        const labels = [];
        for (const item of value) {
          const choice = findChoice(field, item) || await ensureChoice(collectionPlugin, field, item, options);
          labels.push(choice ? choice.label : item);
        }
        if (labels.length && prop.setChoice(labels)) return true;
        prop.set(value);
        return true;
      }

      const choice = findChoice(field, value) || await ensureChoice(collectionPlugin, field, value, options);
      if (choice && prop.setChoice(choice.label || choice.id)) return true;
      if (prop.setChoice(value)) return true;
      prop.set(value);
      return true;
    };

    const findProp = (collectionPlugin, record, key) => {
      const field = (collectionPlugin.getConfiguration().fields || []).find((item) => lc(item.id) === lc(key) || lc(labelOf(item)) === lc(key));
      return record.prop(key) || (field ? record.prop(field.id) || record.prop(labelOf(field)) : null);
    };

    const resolveDefault = (collectionPlugin, record, rule) => {
      const value = rule && typeof rule === "object" && !Array.isArray(rule) ? rule.value || rule.type : rule;
      if (value === "timestamp" || value === "currentTimestamp") return formatTimestamp(record.getCreatedAt?.() || new Date()) || formatTimestamp(new Date());
      if (value === "collection" || value === "collectionName") return collectionPlugin.getName();
      if (value === "collectionGuid") return collectionPlugin.collection.getGuid();
      if (value === "blank") return "";
      if (typeof value === "function") return value({ collectionPlugin, record });
      return value;
    };

    const setDefault = (prop, value) => {
      if (value === undefined) return;
      if (value === "") {
        prop.set([]) || prop.set("");
        return;
      }
      if (prop.setChoice && prop.setChoice(value)) return;
      prop.set(value);
    };

    const applyDefaults = (collectionPlugin, record, options) => {
      const defaults = mapOpt(options, "defaults", "default_values");
      for (const [key, rule] of Object.entries(defaults)) {
        const prop = findProp(collectionPlugin, record, key);
        if (prop) setDefault(prop, resolveDefault(collectionPlugin, record, rule));
      }
    };

    const readControl = (field, input) => {
      if (field.type === "choice" && field.many) return split(input.value);
      if (field.type === "choice") return text(input.value) || null;
      if (field.type === "number") return input.value === "" ? null : Number(input.value);
      if (field.type === "datetime") return input.value ? DateTime.parseDateTimeString(input.value.replace("T", " "))?.value() || null : null;
      if (field.many) return split(input.value);
      return text(input.value) || null;
    };

    const applyValue = async (collectionPlugin, record, field, value, options) => {
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return;
      const prop = record.prop(field.id) || record.prop(labelOf(field));
      if (!prop) return;
      if (field.type === "choice") await setChoice(collectionPlugin, prop, field, value, options);
      else prop.set(value);
    };

    const createControl = (field, options) => {
      const label = document.createElement("label");
      label.style.display = "grid";
      label.style.gap = "6px";

      const title = document.createElement("span");
      title.textContent = labelOf(field);
      title.style.fontWeight = "600";
      label.appendChild(title);

      let input;
      if (field.type === "choice" && !field.many) {
        const listId = `create-choice-${field.id}-${Math.random().toString(36).slice(2)}`;
        input = document.createElement("input");
        input.type = "text";
        input.setAttribute("list", listId);
        input.placeholder = options.allowInlineChoices === false || options.allow_inline_choices === false ? "Select a value" : "Select or type a new value";

        const datalist = document.createElement("datalist");
        datalist.id = listId;
        (field.choices || []).filter((choice) => choice.active !== false).forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.label || choice.id;
          datalist.appendChild(option);
        });
        label.appendChild(datalist);
      } else if (field.type === "choice" || field.many) {
        input = document.createElement("textarea");
        input.placeholder = "Enter one or more values, separated by commas or new lines";
        input.rows = 4;
      } else if (field.type === "number") {
        input = document.createElement("input");
        input.type = "number";
      } else if (field.type === "datetime") {
        input = document.createElement("input");
        input.type = "datetime-local";
      } else {
        input = document.createElement("input");
        input.type = field.type === "url" ? "url" : "text";
      }

      input.dataset.fieldId = field.id;
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.minHeight = field.type === "choice" && field.many ? "110px" : "36px";
      label.appendChild(input);
      return label;
    };

    const waitForRecord = (collectionPlugin, guid, attemptsLeft = 10) => new Promise((resolve, reject) => {
      const record = collectionPlugin.data.getRecord(guid);
      if (record) return resolve(record);
      if (attemptsLeft <= 0) return reject(new Error("Created record was not available for editing."));
      setTimeout(() => waitForRecord(collectionPlugin, guid, attemptsLeft - 1).then(resolve, reject), 100);
    });

    const status = (el, message, isError = false) => {
      el.textContent = message;
      el.style.color = isError ? "var(--danger, #b42318)" : "var(--muted-text, inherit)";
    };

    const titleLooksUntitled = (title) => !title || /^Untitled(?:\s+\w+)?$/.test(title);

    const setTimestampTitle = (collectionPlugin, record) => {
      if (!record) return false;
      const nextTitle = formatTimestamp(record.getCreatedAt?.() || new Date());
      const currentTitle = record.text("Title") || record.text("title") || record.getName();
      const titleProp = findProp(collectionPlugin, record, "title") || findProp(collectionPlugin, record, "Title");
      if (nextTitle && titleProp && titleLooksUntitled(currentTitle)) {
        titleProp.set(nextTitle);
        return true;
      }
      return false;
    };

    const installTimestampTitles = (collectionPlugin) => {
      if (collectionPlugin.__thymerFormInputViewTimestampTitles) return;
      collectionPlugin.__thymerFormInputViewTimestampTitles = true;
      collectionPlugin.collection.getAllRecords().then((records) => records.forEach((record) => setTimestampTitle(collectionPlugin, record)));
      collectionPlugin.events.on("record.created", (event) => {
        const retry = (attemptsLeft = 10) => {
          const record = collectionPlugin.data.getRecord(event.recordGuid);
          if (setTimestampTitle(collectionPlugin, record) || attemptsLeft <= 0) return;
          setTimeout(() => retry(attemptsLeft - 1), 100);
        };
        retry();
      });
    };

    const render = (collectionPlugin, viewCtx, options) => {
      const root = viewCtx.getElement();
      viewCtx.makeNormalLayout?.();
      root.replaceChildren();

      const wrapper = document.createElement("div");
      wrapper.style.maxWidth = "720px";
      wrapper.style.padding = "20px 0";

      const form = document.createElement("form");
      form.style.display = "grid";
      form.style.gap = "14px";

      const fields = getFormFields(collectionPlugin, options);
      fields.forEach((field) => form.appendChild(createControl(field, options)));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.alignItems = "center";
      actions.style.gap = "12px";

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = options.submitLabel || options.submit_label || "Create";
      submit.style.minHeight = "36px";
      submit.style.padding = "0 14px";
      actions.appendChild(submit);

      const statusEl = document.createElement("span");
      statusEl.setAttribute("role", "status");
      actions.appendChild(statusEl);
      form.appendChild(actions);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (viewCtx.isViewingOldVersion()) return status(statusEl, "Cannot create from history view.", true);
        submit.disabled = true;
        status(statusEl, "Creating...");

        try {
          const title = resolveDefault(collectionPlugin, { getCreatedAt: () => new Date() }, mapOpt(options, "defaults", "default_values").title) || "Untitled";
          const guid = viewCtx.createRecord() || collectionPlugin.collection.createRecord(title);
          if (!guid) throw new Error("Record creation failed.");

          const record = await waitForRecord(collectionPlugin, guid);
          applyDefaults(collectionPlugin, record, options);
          for (const field of fields) {
            const input = form.querySelector(`[data-field-id="${CSS.escape(field.id)}"]`);
            if (input) await applyValue(collectionPlugin, record, field, readControl(field, input), options);
          }

          form.reset();
          status(statusEl, `Created ${record.getName?.() || title}.`);
          viewCtx.openRecordInThisPanel(guid);
        } catch (err) {
          status(statusEl, err && err.message ? err.message : "Could not create record.", true);
        } finally {
          submit.disabled = false;
        }
      });

      wrapper.appendChild(form);
      root.appendChild(wrapper);
    };

    window.ThymerFormInputView = {
      bootstrap(collectionPlugin, options = {}) {
        if (!collectionPlugin) return;
        const formOptions = normalizeOptions(collectionPlugin, options);
        this.register(collectionPlugin, formOptions);
        if (formOptions.timestampUntitledTitles || formOptions.timestamp_untitled_titles) installTimestampTitles(collectionPlugin);
      },

      register(collectionPlugin, options = {}) {
        if (!collectionPlugin || !collectionPlugin.views || collectionPlugin.__thymerFormInputViewRegistered) return;
        collectionPlugin.__thymerFormInputViewRegistered = true;
        const formOptions = normalizeOptions(collectionPlugin, options);
        collectionPlugin.views.register(resolveLabel(collectionPlugin, formOptions), (viewCtx) => ({
          onLoad: () => render(collectionPlugin, viewCtx, formOptions),
          onRefresh: () => {},
          onPanelResize: () => {},
          onDestroy: () => {},
          onFocus: () => {},
          onBlur: () => {},
          onKeyboardNavigation: () => {},
          onBustRecordCache: () => {},
        }));
      },
    };
  }

  getDefaultFormInputOptions() {
    const custom = this.getConfiguration().custom || {};
    return custom.formInputView || custom.form_input_view || {};
  }

  getBootstrapCode(options = null) {
    const optionsLiteral = options ? JSON.stringify(options, null, 2) : "{}";
    return `\n\n// THYMER_FORM_INPUT_VIEW_BOOTSTRAP_START\n(() => {\n  const formInputViewConfig = ${optionsLiteral};\n  const bootFormInputView = (plugin, attemptsLeft = 20) => {\n    const registry = window.ThymerFormInputView;\n    if (registry && typeof registry.bootstrap === "function") {\n      registry.bootstrap(plugin, formInputViewConfig);\n      return;\n    }\n    if (attemptsLeft > 0) setTimeout(() => bootFormInputView(plugin, attemptsLeft - 1), 100);\n  };\n\n  const originalOnLoad = Plugin.prototype.onLoad || function () {};\n  Plugin.prototype.onLoad = function (...args) {\n    const result = originalOnLoad.apply(this, args);\n    bootFormInputView(this);\n    return result;\n  };\n})();\n// THYMER_FORM_INPUT_VIEW_BOOTSTRAP_END\n`;
  }

  ensureFormInputViewConfig(config) {
    const options = this.getDefaultFormInputOptions();
    const viewId = options.viewId || options.view_id || "form_input";
    const viewLabel = this.resolveViewLabel(config.name, options);
    const viewIcon = options.viewIcon || options.view_icon || "ti-plus";
    const legacyLabels = ["create", "form input"];
    config.views = config.views || [];

    const fallbackFields = (config.fields || []).filter((field) => {
      return field.active !== false && !field.read_only;
    }).map((field) => field.id);

    const isTarget = (view) => view.type === "custom" && (view.id === viewId || view.label === viewLabel);
    const isLegacy = (view) => view.type === "custom" && legacyLabels.includes(String(view.label || "").trim().toLowerCase());
    const target = config.views.find(isTarget);
    const createLegacy = config.views.find((view) => isLegacy(view) && String(view.label || "").trim().toLowerCase() === "create");
    const firstLegacy = config.views.find(isLegacy);
    const base = createLegacy || target || firstLegacy || {};
    const fields = Array.isArray(base.field_ids) && base.field_ids.length ? base.field_ids : fallbackFields;
    const insertAt = config.views.findIndex((view) => isTarget(view) || isLegacy(view));
    const nextView = {
      ...base,
      id: viewId,
      shown: true,
      icon: viewIcon,
      label: viewLabel,
      description: base.description || "",
      field_ids: fields,
      type: "custom",
      read_only: false,
      group_by_field_id: base.group_by_field_id || null,
      sort_dir: base.sort_dir || "desc",
      sort_field_id: base.sort_field_id || "updated_at",
      opts: base.opts || {},
    };
    const nextViews = config.views.filter((view) => !isTarget(view) && !isLegacy(view));
    nextViews.splice(insertAt >= 0 ? insertAt : nextViews.length, 0, nextView);

    const changed = JSON.stringify(config.views) !== JSON.stringify(nextViews);
    config.views = nextViews;
    return changed;
  }

  resolveViewLabel(collectionName, options) {
    const template = options.viewLabel || options.view_label || "Create $collection_name";
    return String(template)
      .replaceAll("$collection_name", collectionName)
      .replaceAll("${collection_name}", collectionName)
      .replaceAll("{collection_name}", collectionName)
      .replaceAll("$collectionName", collectionName)
      .replaceAll("${collectionName}", collectionName)
      .replaceAll("{collectionName}", collectionName);
  }

  ensureBootstrap(code) {
    const bootstrap = this.getBootstrapCode();
    if (!code || !code.trim()) return `class Plugin extends CollectionPlugin {\n  onLoad() {}\n}${bootstrap}`;
    if (code.includes("THYMER_FORM_INPUT_VIEW_BOOTSTRAP_START")) return code;
    if (code.includes("ThymerFormInputView") && code.includes(".bootstrap")) return code;
    return `${code.replace(/\s+$/, "")}${bootstrap}`;
  }

  async installInAllCollections(showToast) {
    try {
      const collections = await this.data.getAllCollections();
      let updated = 0;

      for (const collection of collections) {
        if (!collection || collection.isJournalPlugin?.()) continue;
        if (typeof collection.getExistingCodeAndConfig !== "function" || typeof collection.savePlugin !== "function") continue;

        const existing = collection.getExistingCodeAndConfig();
        const config = structuredClone(existing.json || {});
        const currentCode = existing.code || "";
        const nextCode = this.ensureBootstrap(currentCode);
        const changedConfig = this.ensureFormInputViewConfig(config);
        const changedCode = nextCode !== currentCode;
        if (!changedConfig && !changedCode) continue;

        await collection.savePlugin(config, nextCode, existing.css || "");
        updated++;
      }

      if (showToast) {
        this.ui.addToaster({
          title: "Form Input View installed",
          message: updated ? `Updated ${updated} collection${updated === 1 ? "" : "s"}.` : "All collections are already configured.",
          dismissible: true,
          autoDestroyTime: 5000,
        });
      }
    } catch (err) {
      console.error("[Form Input View] install failed", err);
      if (showToast) {
        this.ui.addToaster({
          title: "Form Input View install failed",
          message: err && err.message ? err.message : String(err),
          dismissible: true,
          autoDestroyTime: 8000,
        });
      }
    }
  }
}
