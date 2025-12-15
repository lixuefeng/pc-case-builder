# Chassis Forge

**Web-based PC Case Builder & 3D Modeling Tool**

[https://www.chassis-forge.com/](https://www.chassis-forge.com/)

Chassis Forge is a powerful, browser-based 3D design tool specifically optimized for creating custom PC cases. It combines easy-to-use parametric modeling with precise industry standards for computer hardware.

## Features

- **Hardware Presets**: One-click generation of accurate motherboard models (ITX, mATX, ATX) with mounting holes and keep-out zones defined by ATX specifications.
- **CSG Operations**: Construct complex geometries using Constructive Solid Geometry (Union, Subtract, Intersect). Easily cut holes for fans, ports, or airflow.
- **Parametric Parts**: Add and resize cubes, cylinders, and other primitives with precision.
- **Alignment Tools**: Snap parts to faces or aligning edges to ensure perfect fitment.
- **Drill Mode**: Place standard mounting holes (M3, M4, #6-32) and cutouts for I/O shields or PCIe slots.
- **Export**: Export your designs for 3D printing or CNC machining.

## Usage Guide

### Controls
- **Rotate View**: Alt + Left Click + Drag
- **Pan View**: Alt + Right Click + Drag
- **Zoom**: Alt + Mouse Wheel
- **Select Object**: Left Click

### Workflow
1.  **Start with the Core**: Add a motherboard preset (e.g., ITX) from the sidebar to serve as the reference for your case.
2.  **Build the Chassis**: Add simple shapes like Cubes or Planes to form the walls of your case. Use the "Transform" tools to resize and position them.
3.  **Make Connections**: Use the Alignment tools to snap walls to the motherboard standoffs or other structural parts.
4.  **Cut & Detail**: Use the "Subtract" tool to cut ventilation holes or the "Drill" tool to place screw holes for fans and components.

## Tech Stack

Built with modern web technologies for performance and interactivity:

- **[React](https://react.dev/)**: UI and state management.
- **[Three.js](https://threejs.org/)** & **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)**: High-performance 3D rendering.
- **Vite**: Fast build tooling.
- **CSG**: Geometric operations powered by `three-bvh-csg`.

## Getting Started

To run the project locally for development:

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start Dev Server**
    ```bash
    npm run dev
    ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

4.  **Run Tests**
    ```bash
    npm test
    ```

---

*This project is currently under active development.*
