export function armPrompt(state, t) {
  if (state.armed || !state.canArm) return null;
  if (state.radio && !state.radioReady)
    return { title: t("hud.armRadioUnavailable"), detail: t("hud.armRadioSetup") };

  let instruction;
  if (state.mobile || (state.radio && !state.binding)) instruction = t("hud.screenToArm");
  else if (state.radio && state.binding.type === "axis") instruction = t("hud.switchToArm", { control: state.control });
  else instruction = t("hud.pressToArm", { control: state.control });
  return state.lowThrottle
    ? { title: instruction, detail: state.mobile || (state.radio && !state.binding) ? "" : t("hud.armAlternative") }
    : { title: t("hud.lowThrottle"), detail: instruction };
}
