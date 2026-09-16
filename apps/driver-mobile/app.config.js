const { validatePreview } = require("../../packages/mobile/scripts/check-preview.cjs");
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  if ((profile && profile !== "development") || process.env.HATIDONE_RELEASE_BUILD === "1") {
    validatePreview(process.env, profile || "preview");
  }
  return config;
};
