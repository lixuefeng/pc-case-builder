# PSU Spec

## ATX PSU Mounting Holes

Looking from the **Back** of the PSU (Fan/Receptacle side).
Width: 150mm
Height: 86mm

Typically there are 4 holes. The standard ATX specification defines them relative to the bottom-right corner (if viewed from back, fan up or down? Usually fan location varies, but standard orientation is AC receptacle on the right if fan is bottom? Actually, let's use standard ATX coordinate system if possible or standard drawing dimensions).

**Standard ATX Mounting Pattern (Based on Intel Design Guide & Common Asymmetric Layout)**
*Unit: mm.*

**Orientation Definition:**
*   **View**: Looking at the **Rear Face** of the PSU (the side exposed to the outside of the case).
*   **X-Axis (Width)**: The **Long Edge** (150mm). Left is 0, Right is 150.
*   **Y-Axis (Height)**: The **Short Edge** (86mm). Bottom is 0, Top is 86.
*   **Origin (0,0)**: Bottom-Left corner of this rear face.

```
      (Top Left)                                (Top Right)
      0,86 _______________________________________ 150,86
          |   (A)                           (B)   |
          |  <---------- 138 mm Span ---------->  |
  Short   |                                       |   Short
  Edge    |                                       |   Edge
  (Y)     |      (Fan/Switch/Input Area)          |   (Y)
          |                                       |
          |   (D)                           (C)   |
      0,0 |___(.)___________________________(.)___| 150,0
            ^                           ^
       (Bottom Left)                   (Bottom Right)
          6,6         \__ 114 mm __/      120,6

          <---------- Long Edge (X) ----------> 150mm
```

Top Row is typically centered horizontally with 6mm margins.
Bottom Row is asymmetric (Right hole indented).

*   **Hole A (Top-Left)**: X = 6.0, Y = 80.0
*   **Hole B (Top-Right)**: X = 144.0, Y = 80.0
    *   *Span*: 138.0mm
*   **Hole C (Bottom-Right)**: X = 120.0, Y = 6.0
    *   *Right Vertical Span*: 74.0mm (80 - 6)
    *   *Right Horizontal Margin*: 30.0mm (150 - 120)
*   **Hole D (Bottom-Left)**: X = 6.0, Y = 6.0
    *   *Left Vertical Span*: 74.0mm (80 - 6)
    *   *Bottom Horizontal Span*: 114.0mm (120 - 6)

*Note: Chassis manufacturers typically include mirrored holes to allow mounting the PSU with the fan facing up or down. A "Universal" case pattern would overlay the standard pattern with its vertically flipped counterpart.*

## ATX (150 x 86 mm) - PSU Side
| Hole | X (from Left) | Y (from Bottom) | Note |
| :-: | :-: | :-: | --- |
| A | 6.0 | 80.0 | Top-Left |
| B | 144.0 | 80.0 | Top-Right |
| C | 120.0 | 6.0 | Bottom-Right |
| D | 6.0 | 6.0 | Bottom-Left |

## SFX PSU Mounting Holes

*Unit: mm. Origin: Bottom-Left of Rear Face (125mm x 63.5mm)*

**Orientation Definition:**
*   **View**: Looking at the **Rear Face** of the PSU.
*   **X-Axis (Width)**: 125mm.
*   **Y-Axis (Height)**: 63.5mm.

```
      (Top Left)                                (Top Right)
      0,63.5 _____________________________________ 125,63.5
            |   (A)                         (B)   |
            |  <--------- 113 mm Span --------->  |
    Short   |                                     |   Short
    Edge    |                                     |   Edge
    (Y)     |      (Fan/Switch/Input Area)        |   (Y)
            |                                     |
            |   (D)                         (C)   |
      0,0   |___(.)_________________________(.)___| 125,0
              ^                         ^
         (Bottom Left)             (Bottom Right)
            6,6      \__ 113 mm __/    119,6

            <---------- Long Edge (X) ----------> 125mm
```

**Standard SFX 4-Hole Pattern (Symmetric)**
Based on standard 6mm margins from edges.

*   **Hole A (Top-Left)**: X = 6.0, Y = 57.5
*   **Hole B (Top-Right)**: X = 119.0, Y = 57.5
    *   *Span*: 113.0mm (119 - 6)
*   **Hole C (Bottom-Right)**: X = 119.0, Y = 6.0
    *   *Right Vertical Span*: 51.5mm (57.5 - 6)
*   **Hole D (Bottom-Left)**: X = 6.0, Y = 6.0
    *   *Left Vertical Span*: 51.5mm (57.5 - 6)
    *   *Bottom Horizontal Span*: 113.0mm (119 - 6)

## SFX (125 x 63.5 mm) - PSU Side
| Hole | X (from Left) | Y (from Bottom) | Note |
| :-: | :-: | :-: | --- |
| A | 6.0 | 57.5 | Top-Left |
| B | 119.0 | 57.5 | Top-Right |
| C | 119.0 | 6.0 | Bottom-Right |
| D | 6.0 | 6.0 | Bottom-Left |

*Note: Mounting holes are typically #6-32 UNC.*
