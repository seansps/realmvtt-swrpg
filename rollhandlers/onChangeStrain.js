// Update current hp
var strain = record.data?.strain || 0;
var strainThreshold = record.data?.strainThreshold || 0;
var strainRemaining = strainThreshold - strain;
if (strainRemaining < 0) {
  strainRemaining = 0;
}
if (strainRemaining > strainThreshold) {
  strainRemaining = strainThreshold;
}
api.setValue("data.strainRemaining", strainRemaining);
