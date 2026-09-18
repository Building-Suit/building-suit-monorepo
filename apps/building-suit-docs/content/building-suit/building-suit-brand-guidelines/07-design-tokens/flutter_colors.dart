// Building Suit — Color Tokens (Flutter)
// Source of truth: 03-visual-identity/01_COLOR_SYSTEM.md
//
// Single source of truth for the mobile-first Flutter app.
//   - `BuildingSuitColors`      raw brand palette (fixed values).
//   - `BuildingSuitLight`       role tokens for light mode (default theme).
//   - `BuildingSuitDark`        role tokens for dark mode.
//
// KEY RULE: the primary action color flips by mode —
//   light → Building Navy, dark → Premium Gold
//   (gold fails text contrast on light, ~2.5:1).
//
// Usage:
//   final colors = Theme.of(context).brightness == Brightness.dark
//       ? BuildingSuitDark()
//       : BuildingSuitLight();
//   Container(color: colors.surface, child: Text('Hi', style: TextStyle(color: colors.text)));

import 'package:flutter/material.dart';

/// Raw, fixed brand palette. These never change by theme.
class BuildingSuitColors {
  BuildingSuitColors._();

  // Navy family
  static const Color buildingNavy = Color(0xFF16293B);
  static const Color deepStructureNavy = Color(0xFF0D1B28);
  static const Color midnightBackground = Color(0xFF0A111A);
  static const Color navySurface = Color(0xFF14233A);
  static const Color navySurfaceRaised = Color(0xFF1B2E47);
  static const Color steelBorder = Color(0xFF2E3F52);

  // Gold family
  static const Color premiumGold = Color(0xFFD89B42);
  static const Color highlightGold = Color(0xFFEBB45A);
  static const Color gold700 = Color(0xFFA86C1C);
  static const Color gold600 = Color(0xFFC8902F);
  static const Color gold500 = Color(0xFFD89B42);
  static const Color gold400 = Color(0xFFEBB45A);
  static const Color gold300 = Color(0xFFF4CE86);

  // Light / silver family
  static const Color pearlWhite = Color(0xFFF7F8FA);
  static const Color softSilver = Color(0xFFE2E5EA);
  static const Color cloudGray = Color(0xFFCBD2DB);
  static const Color white = Color(0xFFFFFFFF);

  // Secondary blues
  static const Color slateBlue = Color(0xFF36506E);
  static const Color skySteel = Color(0xFF7E97B3);
  static const Color paleSky = Color(0xFFDCE6F1);

  // Neutrals / text
  static const Color graphiteText = Color(0xFF232B33);
  static const Color slateGray = Color(0xFF5A6573);
  static const Color steelGray = Color(0xFF9AA6B4);

  // Semantic — light (base)
  static const Color success = Color(0xFF2E9E6B);
  static const Color successBg = Color(0xFFE4F4EC);
  static const Color warning = Color(0xFFE1841F);
  static const Color warningBg = Color(0xFFFBEEDD);
  static const Color error = Color(0xFFD14B4B);
  static const Color errorBg = Color(0xFFF8E3E3);
  static const Color info = Color(0xFF2F77C9);
  static const Color infoBg = Color(0xFFDCE6F1);

  // Semantic — dark (lightened ~10–15%)
  static const Color successDark = Color(0xFF46B383);
  static const Color successBgDark = Color(0xFF18352A);
  static const Color warningDark = Color(0xFFF09A3C);
  static const Color warningBgDark = Color(0xFF3A2A14);
  static const Color errorDark = Color(0xFFE26A6A);
  static const Color errorBgDark = Color(0xFF3A1E1E);
  static const Color infoDark = Color(0xFF4F92DD);
  static const Color infoBgDark = Color(0xFF15263A);

  // Gradients
  static const Gradient goldGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEBB45A), Color(0xFFD89B42), Color(0xFFA86C1C)],
  );
  static const Gradient navyGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF16293B), Color(0xFF0D1B28)],
  );
}

/// Semantic role tokens. Resolve the correct implementation by brightness.
abstract class BuildingSuitRoles {
  // Surfaces / backgrounds
  Color get background;
  Color get surface;
  Color get surfaceMuted;
  Color get surfaceRaised;

  // Text
  Color get text;
  Color get textMuted;
  Color get textDisabled;
  Color get textOnPrimary;
  Color get textOnAccent;

  // Borders
  Color get border;
  Color get borderStrong;

  // Actions
  Color get primary;
  Color get accent;
  Color get link;
  Color get focusRing;

  // Semantic
  Color get success;
  Color get successBg;
  Color get warning;
  Color get warningBg;
  Color get error;
  Color get errorBg;
  Color get info;
  Color get infoBg;
}

/// Light mode (default theme).
class BuildingSuitLight implements BuildingSuitRoles {
  const BuildingSuitLight();

  @override
  Color get background => BuildingSuitColors.pearlWhite;
  @override
  Color get surface => BuildingSuitColors.white;
  @override
  Color get surfaceMuted => BuildingSuitColors.softSilver;
  @override
  Color get surfaceRaised => BuildingSuitColors.white;

  @override
  Color get text => BuildingSuitColors.graphiteText;
  @override
  Color get textMuted => BuildingSuitColors.slateGray;
  @override
  Color get textDisabled => BuildingSuitColors.steelGray;
  @override
  Color get textOnPrimary => BuildingSuitColors.pearlWhite;
  @override
  Color get textOnAccent => BuildingSuitColors.deepStructureNavy;

  @override
  Color get border => BuildingSuitColors.cloudGray;
  @override
  Color get borderStrong => BuildingSuitColors.slateGray;

  // Primary = Navy on light.
  @override
  Color get primary => BuildingSuitColors.buildingNavy;
  @override
  Color get accent => BuildingSuitColors.premiumGold;
  @override
  Color get link => BuildingSuitColors.slateBlue;
  @override
  Color get focusRing => BuildingSuitColors.premiumGold;

  @override
  Color get success => BuildingSuitColors.success;
  @override
  Color get successBg => BuildingSuitColors.successBg;
  @override
  Color get warning => BuildingSuitColors.warning;
  @override
  Color get warningBg => BuildingSuitColors.warningBg;
  @override
  Color get error => BuildingSuitColors.error;
  @override
  Color get errorBg => BuildingSuitColors.errorBg;
  @override
  Color get info => BuildingSuitColors.info;
  @override
  Color get infoBg => BuildingSuitColors.infoBg;
}

/// Dark mode.
class BuildingSuitDark implements BuildingSuitRoles {
  const BuildingSuitDark();

  @override
  Color get background => BuildingSuitColors.midnightBackground;
  @override
  Color get surface => BuildingSuitColors.navySurface;
  @override
  Color get surfaceMuted => BuildingSuitColors.deepStructureNavy;
  @override
  Color get surfaceRaised => BuildingSuitColors.navySurfaceRaised;

  @override
  Color get text => BuildingSuitColors.pearlWhite;
  @override
  Color get textMuted => BuildingSuitColors.skySteel;
  @override
  Color get textDisabled => const Color(0xFF4A5A6E);
  @override
  Color get textOnPrimary => BuildingSuitColors.deepStructureNavy;
  @override
  Color get textOnAccent => BuildingSuitColors.deepStructureNavy;

  @override
  Color get border => BuildingSuitColors.steelBorder;
  @override
  Color get borderStrong => BuildingSuitColors.skySteel;

  // Primary flips to Gold on dark.
  @override
  Color get primary => BuildingSuitColors.premiumGold;
  @override
  Color get accent => BuildingSuitColors.highlightGold;
  @override
  Color get link => BuildingSuitColors.skySteel;
  @override
  Color get focusRing => BuildingSuitColors.highlightGold;

  @override
  Color get success => BuildingSuitColors.successDark;
  @override
  Color get successBg => BuildingSuitColors.successBgDark;
  @override
  Color get warning => BuildingSuitColors.warningDark;
  @override
  Color get warningBg => BuildingSuitColors.warningBgDark;
  @override
  Color get error => BuildingSuitColors.errorDark;
  @override
  Color get errorBg => BuildingSuitColors.errorBgDark;
  @override
  Color get info => BuildingSuitColors.infoDark;
  @override
  Color get infoBg => BuildingSuitColors.infoBgDark;
}
