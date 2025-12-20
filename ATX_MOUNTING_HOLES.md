# ATX Motherboard Mounting Holes

*Unit: mm. Based on derived coordinates in this project.*

**Orientation Definition:**
*   **View**: **Front** of the Motherboard (Component Side).
*   **X-Axis**: Horizontal Line passing through vertical mounting column **F, J, M**. (Rightmost holes).
*   **Y-Axis**: Vertical Line passing through horizontal mounting row **A, B, C**. (Topmost holes).
*   **Origin (0,0)**: Intersection of these two lines. (Component Area Top-Right).
    *   *Note: Board PCB extends slightly beyond these axes.*

```
      (Top Left)                                     (Top Right)
     Board Edge
   [  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ] .  .  .
   [                                                 ]
   [ Y=0 +----(A)--------(B)--------(C)--------------+
   [     |                             .             |
   [     |                            (F) [0, 22.86] |
   [     |                (X=0 Line)   .             |
   [     |                             .             |
   [     |    (G)        (H)           .  (J)        |
   [     |                             .             |
   [     |                             .             |
   [     |    (K)        (L)           .  (M)        |
   [     |                                           |
   [  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ] .  .  .
```

**Hole Locations (mm)**
*Relative to defined origin (Row A-C, Col F-M).*

| Hole | X (mm) | Y (mm) | Description | Compatibility |
| :--: | :----: | :----: | :---------- | :------------ |
| **A** | -281.94 | 0.00 | Top-Left (ATX) | ATX |
| **B** | -203.20 | 0.00 | Top-Left (mATX) | ATX, mATX |
| **C** | -157.48 | 0.00 | Top-Left (ITX) | ATX, mATX, ITX |
| **F** | 0.00 | 22.86 | Top-Right (mATX/ITX) | ATX, mATX, ITX |
| **G** | -281.94 | 154.94 | Mid-Left (ATX) | ATX |
| **H** | -157.48 | 154.94 | Mid-Left (mATX/ITX) | ATX, mATX, ITX |
| **J** | 0.00 | 154.94 | Mid-Right | ATX, mATX, ITX |
| **K** | -281.94 | 227.33 | Bot-Left (ATX) | ATX |
| **L** | -157.48 | 227.33 | Bot-Left (mATX/ITX) | ATX, mATX |
| **M** | 0.00 | 227.33 | Bot-Right | ATX, mATX |

*Note: Coordinates based on ATX Specification V2.2 relative to "Reference Point" logic used in calculation.*

**Form Factor Hole Sets:**
*   **ITX**: C, F, H, J
*   **mATX**: B, C, F, H, J, L, M
*   **ATX**: A, B, C, F, G, H, J, K, L, M