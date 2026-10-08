/** Campaign 01 D2 spaced-pod-line study material registration. Experimental registration mechanism copied from D1 commit bc0b0b454ec0ce129de5ddb3de180e79bdeae00b and adapted for D2 IDs. */
import {
  SPACED_POD_LINE_D2_VERSION,
  createSpacedPodLineD2,
  registerExperimentalGenerator,
  registerExperimentalMaterial,
  setExperimentalMaterialEnabled,
} from "../core/index.ts";

export const CAMPAIGN_D2_QUERY_PARAM = "campaignD2" as const;
export const CAMPAIGN_D2_MATERIAL_ID = "spaced-pod-line-d2" as const;

const CHOICE_TESTID = "material-choice-spaced-pod-line-d2";
const CHOICE_LABEL = "Spaced pod line (study)";
const TEMPLATE_ID = `material-template-${CAMPAIGN_D2_MATERIAL_ID}`;

let registered = false;

function registerD2GeneratorAndMaterial() {
  if (registered) return;
  registerExperimentalGenerator({
    generatorVersion: SPACED_POD_LINE_D2_VERSION,
    generate: createSpacedPodLineD2,
  });
  registerExperimentalMaterial({
    materialId: CAMPAIGN_D2_MATERIAL_ID,
    generator: {
      generatorVersion: SPACED_POD_LINE_D2_VERSION,
      generate: createSpacedPodLineD2,
    },
  });
  registered = true;
}

function ensurePickerChoice(root: HTMLElement) {
  const nav = root.querySelector<HTMLElement>("#material-options");
  if (!nav) return;
  if (nav.querySelector(`[data-material-choice="${CAMPAIGN_D2_MATERIAL_ID}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.materialChoice = CAMPAIGN_D2_MATERIAL_ID;
  button.dataset.testid = CHOICE_TESTID;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `
    <svg class="cutting-silhouette" viewBox="0 0 300 72" aria-hidden="true" focusable="false">
      <path class="cutting-stem" d="M28 60 C96 53 154 38 208 24 C238 16 262 11 282 8" />
      <path class="cutting-twig" d="M112 45 C126 40 138 34 148 26" />
      <path class="cutting-twig" d="M170 30 C182 24 194 20 206 16" />
      <path class="cutting-twig" d="M230 18 C242 14 254 11 266 10" />
      <g class="cutting-berry">
        <circle cx="150" cy="26" r="3.8" />
        <circle cx="206" cy="16" r="4" />
        <circle cx="214" cy="22" r="3.4" />
        <circle cx="266" cy="10" r="3.8" />
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
  template.dataset.materialLabel = "spaced pod line study";
  template.innerHTML = `
    <svg class="cutting-silhouette" viewBox="0 0 300 72" aria-hidden="true" focusable="false">
      <path class="cutting-stem" d="M28 60 C96 53 154 38 208 24 C238 16 262 11 282 8" />
      <path class="cutting-twig" d="M112 45 C126 40 138 34 148 26" />
      <path class="cutting-twig" d="M170 30 C182 24 194 20 206 16" />
      <path class="cutting-twig" d="M230 18 C242 14 254 11 266 10" />
      <g class="cutting-berry">
        <circle cx="150" cy="26" r="3.8" />
        <circle cx="206" cy="16" r="4" />
        <circle cx="214" cy="22" r="3.4" />
        <circle cx="266" cy="10" r="3.8" />
      </g>
    </svg>
    <span class="material-copy">
      <span class="material-name">Spaced pod line (study)</span>
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

export function configureCampaignD2Study(root: HTMLElement, enabled: boolean): void {
  registerD2GeneratorAndMaterial();
  setExperimentalMaterialEnabled(CAMPAIGN_D2_MATERIAL_ID, enabled);
  if (enabled) {
    ensurePickerChoice(root);
    ensureSourceTemplate(root);
  } else {
    removeInjectedPicker(root);
  }
}

export function configureCampaignD2Runtime(enabled: boolean): void {
  registerD2GeneratorAndMaterial();
  setExperimentalMaterialEnabled(CAMPAIGN_D2_MATERIAL_ID, enabled);
}
