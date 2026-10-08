/** Campaign 01 D1 paired-leaf study port, adapted from PR #62 commit 98588a60c0d3c62437bfd109a39776bc8aea49ed (paired leaf only; sparse cane excluded). */
import {
  PAIRED_LEAF_D1_VERSION,
  createPairedLeafD1,
  registerExperimentalGenerator,
  registerExperimentalMaterial,
  setExperimentalMaterialEnabled,
} from "../core/index.ts";

export const CAMPAIGN_D1_QUERY_PARAM = "campaignD1" as const;
export const CAMPAIGN_D1_MATERIAL_ID = "paired-leaf-d1" as const;

const CHOICE_TESTID = "material-choice-paired-leaf-d1";
const CHOICE_LABEL = "Paired leaf (study)";
const TEMPLATE_ID = `material-template-${CAMPAIGN_D1_MATERIAL_ID}`;

let registered = false;

function registerD1GeneratorAndMaterial() {
  if (registered) return;
  registerExperimentalGenerator({
    generatorVersion: PAIRED_LEAF_D1_VERSION,
    generate: createPairedLeafD1,
  });
  registerExperimentalMaterial({
    materialId: CAMPAIGN_D1_MATERIAL_ID,
    generator: {
      generatorVersion: PAIRED_LEAF_D1_VERSION,
      generate: createPairedLeafD1,
    },
  });
  registered = true;
}

function ensurePickerChoice(root: HTMLElement) {
  const nav = root.querySelector<HTMLElement>("#material-options");
  if (!nav) return;
  if (nav.querySelector(`[data-material-choice="${CAMPAIGN_D1_MATERIAL_ID}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.materialChoice = CAMPAIGN_D1_MATERIAL_ID;
  button.dataset.testid = CHOICE_TESTID;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `
    <svg class="cutting-silhouette" viewBox="0 0 300 72" aria-hidden="true" focusable="false">
      <path class="cutting-stem" d="M148 66 C146 53 146 36 148 20 C149 14 151 9 154 6" />
      <g class="cutting-leaf">
        <ellipse cx="130" cy="52" rx="22" ry="7" transform="rotate(26 130 52)" />
        <ellipse cx="168" cy="49" rx="22" ry="7" transform="rotate(-28 168 49)" />
        <ellipse cx="126" cy="39" rx="20" ry="6.5" transform="rotate(24 126 39)" />
        <ellipse cx="172" cy="36" rx="20" ry="6.5" transform="rotate(-26 172 36)" />
        <ellipse cx="132" cy="26" rx="17" ry="5.8" transform="rotate(22 132 26)" />
        <ellipse cx="170" cy="23" rx="17" ry="5.8" transform="rotate(-24 170 23)" />
        <ellipse cx="140" cy="14" rx="14" ry="5.2" transform="rotate(20 140 14)" />
        <ellipse cx="166" cy="12" rx="14" ry="5.2" transform="rotate(-22 166 12)" />
      </g>
    </svg>
    <span class="material-choice-name">${CHOICE_LABEL}</span>
  `;
  nav.append(button);
}

function ensureSourceTemplate(root: HTMLElement) {
  const templates = root.querySelector<HTMLElement>("#material-templates");
  if (!templates) return;
  if (templates.querySelector(`#${TEMPLATE_ID}`)) return;
  const template = document.createElement("template");
  template.id = TEMPLATE_ID;
  template.dataset.materialLabel = "paired leaf study";
  template.innerHTML = `
    <svg class="cutting-silhouette" viewBox="0 0 300 72" aria-hidden="true" focusable="false">
      <path class="cutting-stem" d="M148 66 C146 53 146 36 148 20 C149 14 151 9 154 6" />
      <g class="cutting-leaf">
        <ellipse cx="130" cy="52" rx="22" ry="7" transform="rotate(26 130 52)" />
        <ellipse cx="168" cy="49" rx="22" ry="7" transform="rotate(-28 168 49)" />
        <ellipse cx="126" cy="39" rx="20" ry="6.5" transform="rotate(24 126 39)" />
        <ellipse cx="172" cy="36" rx="20" ry="6.5" transform="rotate(-26 172 36)" />
        <ellipse cx="132" cy="26" rx="17" ry="5.8" transform="rotate(22 132 26)" />
        <ellipse cx="170" cy="23" rx="17" ry="5.8" transform="rotate(-24 170 23)" />
        <ellipse cx="140" cy="14" rx="14" ry="5.2" transform="rotate(20 140 14)" />
        <ellipse cx="166" cy="12" rx="14" ry="5.2" transform="rotate(-22 166 12)" />
      </g>
    </svg>
    <span class="material-copy">
      <span class="material-name">Paired leaf (study)</span>
      <span class="material-verb">drag to the pins</span>
    </span>
    <span class="material-grip" aria-hidden="true"><i></i><i></i><i></i></span>
  `;
  templates.append(template);
}

function removeInjectedPicker(root: HTMLElement) {
  root.querySelector(`[data-testid="${CHOICE_TESTID}"]`)?.remove();
  root.querySelector(`#${TEMPLATE_ID}`)?.remove();
}

export function configureCampaignD1Study(root: HTMLElement, enabled: boolean): void {
  registerD1GeneratorAndMaterial();
  setExperimentalMaterialEnabled(CAMPAIGN_D1_MATERIAL_ID, enabled);
  if (enabled) {
    ensurePickerChoice(root);
    ensureSourceTemplate(root);
  } else {
    removeInjectedPicker(root);
  }
}

export function configureCampaignD1Runtime(enabled: boolean): void {
  registerD1GeneratorAndMaterial();
  setExperimentalMaterialEnabled(CAMPAIGN_D1_MATERIAL_ID, enabled);
}
