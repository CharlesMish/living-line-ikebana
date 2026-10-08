import { createReedFineB2, REED_FINE_B2_VERSION } from "../core/reedFineB2.ts";
import { successfulSeatIdentity, type MaterialInsertionPreparation, type Vec3 } from "../core/index.ts";

export const CAMPAIGN_B2_QUERY_PARAM = "campaignB2" as const;
export const CAMPAIGN_B2_MATERIAL_ID = "reed-fine-b2" as const;

export function campaignB2Enabled(url = new URL(window.location.href)): boolean {
  return url.searchParams.get(CAMPAIGN_B2_QUERY_PARAM) === "1";
}

export function prepareCampaignB2Insertion(
  materialId: string,
  ordinal: number,
  base: Vec3,
): MaterialInsertionPreparation | null {
  if (materialId !== CAMPAIGN_B2_MATERIAL_ID) return null;
  const identity = successfulSeatIdentity(ordinal);
  return {
    ok: true,
    material: {
      materialId: CAMPAIGN_B2_MATERIAL_ID,
      generator: {
        generatorVersion: REED_FINE_B2_VERSION,
        generate: createReedFineB2,
      },
    },
    ordinal,
    plantId: identity.id,
    seed: identity.seed,
    graph: createReedFineB2(identity.id, identity.seed, base),
  };
}

export function installCampaignB2MaterialOption(root: ParentNode): void {
  const menu = root.querySelector<HTMLElement>("#material-options");
  const templates = root.querySelector<HTMLElement>("#material-templates");
  const reedChoice = root.querySelector<HTMLButtonElement>('[data-material-choice="reed"]');
  const reedTemplate = root.querySelector<HTMLTemplateElement>("#material-template-reed");
  if (!menu || !templates || !reedChoice || !reedTemplate) return;
  if (menu.querySelector(`[data-material-choice="${CAMPAIGN_B2_MATERIAL_ID}"]`)) return;
  if (templates.querySelector(`#material-template-${CAMPAIGN_B2_MATERIAL_ID}`)) return;

  const choice = reedChoice.cloneNode(true) as HTMLButtonElement;
  choice.dataset.materialChoice = CAMPAIGN_B2_MATERIAL_ID;
  choice.dataset.testid = `material-choice-${CAMPAIGN_B2_MATERIAL_ID}`;
  choice.setAttribute("aria-pressed", "false");
  const choiceLabel = choice.querySelector(".material-choice-name");
  if (choiceLabel) choiceLabel.textContent = "Reed fine (B2 study)";
  menu.append(choice);

  const template = reedTemplate.cloneNode(true) as HTMLTemplateElement;
  template.id = `material-template-${CAMPAIGN_B2_MATERIAL_ID}`;
  template.dataset.materialLabel = "reed fine";
  const templateTitle = template.content.querySelector(".material-name");
  if (templateTitle) templateTitle.textContent = "Reed fine (B2 study)";
  templates.append(template);
}
