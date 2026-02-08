# Optional PBR Road Assets

Put optional texture files in this folder to override procedural road textures.

## Supported files

- `asphalt_basecolor.jpg`
  - sRGB color map for asphalt base color.
- `asphalt_normal.jpg`
  - tangent-space normal map for asphalt micro detail.
- `asphalt_roughness.jpg`
  - roughness map (white = rough, black = smooth).

## Behavior

- If all three files exist, the game auto-loads them at runtime and replaces procedural road maps.
- If any file is missing, the game keeps using built-in procedural maps (no hard failure).

## Recommended texture setup

- Resolution: 2K or 4K.
- Seamless / tileable textures.
- Keep lane markings out of these textures (lane wear overlay is generated in code).
