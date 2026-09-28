/**
 * withCargoOneDriverNativeDiagnostic — R71.16.6 TEMPORARY diagnostic plugin.
 *
 * Injects a lightweight Objective-C `UIView` overlay into the generated
 * `AppDelegate.mm` so the Driver iOS app can display its startup state
 * BEFORE (and INDEPENDENT of) the React root ever renders.
 *
 * Why this is needed:
 *   JS-side diagnostics (`BootDiagnosticApp`) cannot help when the failure
 *   happens inside `require("expo")` itself — Expo.fx.js already registers
 *   an internal `AppEntryNotFound` fallback component at module scope. If
 *   any transitive import throws before our `registerRootComponent(...)`
 *   call, the iPhone silently displays `AppEntryNotFound` (background
 *   #f2f2f2 with tiny red text) which reads as an essentially-blank
 *   light-grey/white screen on the device. No JS overlay can help there.
 *
 * How this works:
 *   - Adds a full-window `UIView` in `didFinishLaunchingWithOptions:` BEFORE
 *     `[super application:didFinishLaunchingWithOptions:]` — i.e. before RN
 *     bootstrap. Six UILabels report progress through native/JS bridge
 *     lifecycle stages.
 *   - Subscribes to standard `RCTBridge` NSNotifications (available in every
 *     RN version — no private API):
 *       * `RCTBridgeWillReloadNotification` / `RCTBridgeDidNotFindHotLoaderNotification`
 *       * `RCTJavaScriptWillStartLoadingNotification`
 *       * `RCTJavaScriptDidLoadNotification` (with error userInfo if failed)
 *       * `RCTJavaScriptDidFailToLoadNotification`
 *       * `RCTContentDidAppearNotification` (= React actually rendered)
 *   - Updates each label's text and colour synchronously on the main queue as
 *     stages fire. On `RCTContentDidAppear` the overlay animates out — the
 *     real Driver UI stays as the active view underneath.
 *   - On failure notifications, freezes with the last successful stage +
 *     the raw NSError message/domain/code visible on-device.
 *
 * Removal:
 *   Delete this file and remove the "../../plugins/withCargoOneDriverNativeDiagnostic"
 *   entry from `mobile/apps/driver/app.json` plugins array. The generated
 *   `ios/` folder is gitignored, so the injected Objective-C disappears on
 *   the next clean prebuild.
 */
const { withAppDelegate } = require('@expo/config-plugins');

// Objective-C snippet inserted at the TOP of didFinishLaunchingWithOptions:.
// This runs BEFORE [super application:...] which starts the RN bridge, so
// the overlay is guaranteed to be on-screen before any RN state exists.
const OVERLAY_SETUP_MARKER = '// __CARGOONE_DIAG_OVERLAY_MARKER__';
const OVERLAY_SETUP = `
  ${OVERLAY_SETUP_MARKER}
  // ─── R71.16.6 CargoOne Native Startup Diagnostic ───────────────────────
  // Injected by mobile/plugins/withCargoOneDriverNativeDiagnostic.js.
  // Safe to remove: delete the plugin from app.json and re-prebuild.
  UIWindow *__diagWindow = [[UIApplication sharedApplication] delegate].window;
  if (__diagWindow == nil) {
    __diagWindow = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window = __diagWindow;
  }
  UIView *__diagOverlay = [[UIView alloc] initWithFrame:[UIScreen mainScreen].bounds];
  __diagOverlay.backgroundColor = [UIColor colorWithRed:0.04 green:0.04 blue:0.04 alpha:1.0];
  __diagOverlay.tag = 907061; // 'CARGOONE_DIAG'
  __diagOverlay.userInteractionEnabled = NO;

  UIView *__diagStack = [[UIView alloc] initWithFrame:CGRectMake(20, 80, [UIScreen mainScreen].bounds.size.width - 40, 400)];
  [__diagOverlay addSubview:__diagStack];

  UILabel *__diagTitle = [[UILabel alloc] initWithFrame:CGRectMake(0, 0, __diagStack.frame.size.width, 30)];
  __diagTitle.text = @"CargoOne Driver Native Diagnostic";
  __diagTitle.textColor = [UIColor whiteColor];
  __diagTitle.font = [UIFont boldSystemFontOfSize:18];
  [__diagStack addSubview:__diagTitle];

  UILabel *__diagSubtitle = [[UILabel alloc] initWithFrame:CGRectMake(0, 32, __diagStack.frame.size.width, 20)];
  __diagSubtitle.text = @"If you can read this, native side is alive.";
  __diagSubtitle.textColor = [UIColor colorWithWhite:1.0 alpha:0.5];
  __diagSubtitle.font = [UIFont systemFontOfSize:12];
  __diagSubtitle.numberOfLines = 2;
  [__diagStack addSubview:__diagSubtitle];

  NSArray<NSString *> *__diagStageNames = @[
    @"1. Native app launched",
    @"2. RCT bridge created",
    @"3. JS bundle download started",
    @"4. JS bundle loaded",
    @"5. Root component registered",
    @"6. React content rendered",
  ];
  NSMutableArray<UILabel *> *__diagStageLabels = [NSMutableArray array];
  for (NSUInteger i = 0; i < __diagStageNames.count; i++) {
    UILabel *lbl = [[UILabel alloc] initWithFrame:CGRectMake(0, 70 + i * 28, __diagStack.frame.size.width, 24)];
    lbl.text = [NSString stringWithFormat:@"○ %@", __diagStageNames[i]];
    lbl.textColor = [UIColor colorWithWhite:1.0 alpha:0.4];
    lbl.font = [UIFont systemFontOfSize:14];
    [__diagStageLabels addObject:lbl];
    [__diagStack addSubview:lbl];
  }

  UILabel *__diagErrorLabel = [[UILabel alloc] initWithFrame:CGRectMake(0, 250, __diagStack.frame.size.width, 200)];
  __diagErrorLabel.textColor = [UIColor colorWithRed:0.99 green:0.65 blue:0.65 alpha:1.0];
  __diagErrorLabel.font = [UIFont fontWithName:@"Menlo" size:11];
  __diagErrorLabel.numberOfLines = 0;
  __diagErrorLabel.text = @"";
  [__diagStack addSubview:__diagErrorLabel];

  __diagStageLabels[0].text = @"✓ 1. Native app launched";
  __diagStageLabels[0].textColor = [UIColor colorWithRed:0.29 green:0.87 blue:0.5 alpha:1.0];

  void (^__diagMark)(NSUInteger, BOOL) = ^(NSUInteger idx, BOOL ok) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (idx >= __diagStageLabels.count) return;
      UILabel *l = __diagStageLabels[idx];
      NSString *prefix = ok ? @"✓" : @"✗";
      UIColor *c = ok
        ? [UIColor colorWithRed:0.29 green:0.87 blue:0.5 alpha:1.0]
        : [UIColor colorWithRed:0.97 green:0.44 blue:0.44 alpha:1.0];
      l.text = [NSString stringWithFormat:@"%@ %@", prefix, __diagStageNames[idx]];
      l.textColor = c;
    });
  };
  void (^__diagReportError)(NSError *) = ^(NSError *err) {
    if (err == nil) return;
    dispatch_async(dispatch_get_main_queue(), ^{
      __diagErrorLabel.text = [NSString stringWithFormat:@"%@ (code %ld)\\n%@",
        err.domain, (long)err.code, err.localizedDescription ?: @"(no description)"];
    });
  };

  NSNotificationCenter *__diagNC = [NSNotificationCenter defaultCenter];
  [__diagNC addObserverForName:@"RCTJavaScriptWillStartLoadingNotification" object:nil queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) { __diagMark(1, YES); __diagMark(2, YES); }];
  [__diagNC addObserverForName:@"RCTJavaScriptDidLoadNotification" object:nil queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
    NSError *err = note.userInfo[@"error"];
    if (err) { __diagMark(3, NO); __diagReportError(err); }
    else { __diagMark(3, YES); }
  }];
  [__diagNC addObserverForName:@"RCTJavaScriptDidFailToLoadNotification" object:nil queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
    NSError *err = note.userInfo[@"error"];
    __diagMark(3, NO);
    __diagReportError(err);
  }];
  [__diagNC addObserverForName:@"RCTBridgeWillReloadNotification" object:nil queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) { /* reload underway */ }];
  [__diagNC addObserverForName:@"RCTContentDidAppearNotification" object:nil queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
    __diagMark(4, YES);
    __diagMark(5, YES);
    // Fade out overlay so the real Driver UI is revealed underneath.
    [UIView animateWithDuration:0.35 delay:0.4 options:UIViewAnimationOptionCurveEaseOut
                     animations:^{ __diagOverlay.alpha = 0.0; }
                     completion:^(BOOL finished) { [__diagOverlay removeFromSuperview]; }];
  }];
  // ────────────────────────────────────────────────────────────────────────
`;

// The overlay itself must be attached AFTER [super application:...]
// returns — because super sets self.window to the RCTRootView-owning window.
// We add the overlay as the topmost subview of self.window so it covers
// whatever RN is drawing (including the empty white RCTRootView) until
// RCTContentDidAppear fires.
const OVERLAY_ATTACH_MARKER = '// __CARGOONE_DIAG_ATTACH_MARKER__';
const OVERLAY_ATTACH = `
  ${OVERLAY_ATTACH_MARKER}
  if (self.window != nil && __diagOverlay != nil) {
    [self.window addSubview:__diagOverlay];
    [self.window bringSubviewToFront:__diagOverlay];
  }
`;

module.exports = function withCargoOneDriverNativeDiagnostic(config) {
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(OVERLAY_SETUP_MARKER)) {
      // Already applied on a previous prebuild run — idempotent.
      return cfg;
    }
    // Locate the didFinishLaunchingWithOptions method opening brace. Expo
    // SDK 51 template uses either RCTAppDelegate or a custom shape; the
    // marker "self.moduleName = @" or "didFinishLaunchingWithOptions" +
    // "{" is very stable.
    const methodSig = 'didFinishLaunchingWithOptions:(NSDictionary *)launchOptions';
    const openBraceIdx = src.indexOf(methodSig);
    if (openBraceIdx === -1) {
      // Shape unknown — do NOT modify to avoid breaking the build.
      // Log a marker in the file so we can grep for it.
      cfg.modResults.contents = `// [withCargoOneDriverNativeDiagnostic] SKIPPED: didFinishLaunchingWithOptions signature not found.\n${src}`;
      return cfg;
    }
    // Advance to the first '{' after the signature — that's the method body start.
    const bodyStart = src.indexOf('{', openBraceIdx) + 1;
    // Insert OVERLAY_SETUP right after `{`.
    src = src.slice(0, bodyStart) + '\n' + OVERLAY_SETUP + '\n' + src.slice(bodyStart);

    // Rewrite `return [super application:... ];` so we can attach the
    // overlay AFTER super's -[application:didFinishLaunchingWithOptions:]
    // returns (that is when RN's window/rootView is fully wired) but BEFORE
    // we return control to iOS. Preserves the original return value.
    const superCallLine = 'return [super application:application didFinishLaunchingWithOptions:launchOptions];';
    if (src.includes(superCallLine)) {
      const replacement =
        'BOOL __diagSuperResult = [super application:application didFinishLaunchingWithOptions:launchOptions];\n' +
        OVERLAY_ATTACH +
        '\n  return __diagSuperResult;';
      src = src.replace(superCallLine, replacement);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
