// Compile for the intended output pipeline, then restore the render target
// immediately: asynchronous shader compilation must not hold renderer state.
export async function compileForTarget(renderer, scene, camera, target = null) {
  const previous = renderer.getRenderTarget();
  let ready;
  try {
    renderer.setRenderTarget(target);
    ready = renderer.compileAsync(scene, camera);
  } finally {
    renderer.setRenderTarget(previous);
  }
  await ready;
}

export async function prepareFlightViews(flight, { analog = false, current = () => true } = {}) {
  const originalView = flight.view;
  const pilotPosition = flight.cameraRig?.pilotPosition?.clone();
  try {
    if (!current()) return false;
    // The clean FPV view hides the model. Reveal it while registering CSM
    // hooks, otherwise the first V press introduces new material programs.
    flight.setView('chase');
    flight.parkShadows?.update({dynamic:true});
    await compileForTarget(flight.renderer, flight.scene, flight.camera);
    if (!current()) return false;
    // Upload model buffers and prepare depth/shadow programs under loading.
    flight.render(0, false);
    if (analog) {
      const effect = flight.getAnalogVideo();
      effect.resize();
      await compileForTarget(flight.renderer, flight.scene, flight.camera, effect.target);
      if (!current()) return false;
      await compileForTarget(flight.renderer, effect.screen, effect.camera);
      if (!current()) return false;
      flight.render(0, true);
    }
    flight.setView('fpv');
    flight.render(0, analog);
    return true;
  } finally {
    if (current()) {
      flight.setView(originalView, originalView === 'pilot' ? {pilotPosition} : undefined);
      flight.render(0, analog && !flight.chase && originalView !== 'pilot');
      flight.analogVideo?.reset();
    }
  }
}
