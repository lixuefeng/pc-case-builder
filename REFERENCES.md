# Project References and Resources

This file maintains a list of external specifications, resources, and documentation used in the development of the PC Case Builder.

## Specifications

### Motherboard Standard
- **ATX 2.2 Specification**: [Instructables PDF](https://cdn.instructables.com/ORIG/FS8/5ILB/GU59Z1AT/FS85ILBGU59Z1AT.pdf)
  - Used for ATX/mATX/ITX hole positions and keepout zones (referenced in `src/config/motherboardPresets.js`).

### Power Supply Unit (PSU)
- **ATX Version 3.0 Multi Rail Desktop Platform Power Supply Design Guide**: [Intel Design Guide (Doc 336521)](https://www.intel.com/content/www/us/en/content-details/336521/atx-version-3-0-multi-rail-desktop-platform-power-supply-design-guide.html)
  - Referenced for PSU dimensions and connector standards.

### Expansion Cards
- **PCI Express Card Electromechanical Specification Revision 3.0**: [Unofficial PDF](https://xdevs.com/doc/Standards/PCI_Express_CEM_r3.0.pdf)
  - Referenced for GPU bracket dimensions, PCIe finger placement, and slot spacing (e.g., `src/utils/gpuPcieSpec.js`).
  - *Note: Official specifications are available from PCI-SIG.*

## Project Links

- **Official Website**: [Chassis Forge](https://www.chassis-forge.com/)
- **GitHub Repository**: [GitHub](https://github.com/lixuefeng/pc-case-builder)
- **Issue Tracker**: [GitHub Issues](https://github.com/lixuefeng/pc-case-builder/issues)
