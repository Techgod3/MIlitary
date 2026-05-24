# MIlitary - Unreal Engine Flight Combat Simulator

A realistic 3D naval combat flight simulator built with Unreal Engine 5.4. Pilot a fighter jet against enemy aircraft, naval vessels, and surface-to-air missile defenses.

## Features

- **Dynamic Flight Physics**: Realistic aircraft controls with pitch, roll, and yaw mechanics
- **Combat Gameplay**: Destroy enemy aircraft and naval targets
- **Advanced Weaponry**: Vulcan cannons, guided missiles, and flare countermeasures
- **AI Enemies**: Enemy fighters and defensive systems
- **HUD System**: Real-time flight instruments and targeting display
- **Particle Effects**: Explosions, gun fire, and missile trails

## Project Structure

```
Source/
├── MIlitary/
│   ├── MIlitaryGameMode.h/cpp      - Game mode and mission logic
│   ├── PlayerAircraft.h/cpp        - Player-controlled aircraft
│   ├── AirTarget.h/cpp             - Target base class
│   └── MIlitary.Build.cs           - Build configuration
```

## Getting Started

### Requirements
- Unreal Engine 5.4 or later
- Windows 10/11 or macOS
- Visual Studio 2019+ (for Windows)

### Building

1. Clone this repository
2. Right-click `MIlitary.uproject` and select **Generate Visual Studio project files**
3. Open the `.sln` file in Visual Studio
4. Build the project
5. Run the editor or packaged game

## Controls

| Input | Action |
|-------|--------|
| `W/S` | Pitch Up/Down |
| `A/D` | Roll Left/Right |
| `Mouse` | Free look (in flight) |
| `Space` | Fire cannons |
| `Q` | Launch missile |
| `F` | Deploy flares |
| `M` | Toggle radar |

## Gameplay

### Objectives
- Destroy all enemy aircraft
- Sink all naval vessels
- Return to base safely

### Scoring
- Enemy Fighter: 1,000 points
- Naval Vessel: 2,500 points
- SAM Site: 500 points

### Game Over Conditions
- Aircraft destroyed
- Terrain collision
- Fuel depleted
- Mission objective failed

## Development Roadmap

- [ ] Enemy AI fighter pilots
- [ ] Naval vessel physics and AI
- [ ] SAM battery systems
- [ ] Improved particle effects
- [ ] Sound design and audio
- [ ] Campaign missions
- [ ] Multiplayer support
- [ ] Performance optimization

## Contributing

Contributions are welcome! Please submit pull requests with:
- Clear descriptions of changes
- Bug fixes with reproduction steps
- Feature requests with design details

## License

Proprietary - All rights reserved

## Credits

Project Lead: Techgod3

---

**Status**: Early Development
**Last Updated**: 2026-05-24
