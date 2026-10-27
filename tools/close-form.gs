// Google Apps Script, bound to the Winner form (form editor → ⋮ → Apps Script).
// Run scheduleClose() once: the form stops accepting responses at 22:00 Israel time on election day.

function closeForm() {
  FormApp.getActiveForm().setAcceptingResponses(false);
}

function scheduleClose() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('closeForm').timeBased().at(new Date('2026-10-27T22:00:00+02:00')).create();
}
