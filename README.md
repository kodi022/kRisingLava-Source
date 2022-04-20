# omegga-kRisingLava
A typed safe plugin for [omegga](https://github.com/brickadia-community/omegga).

The Rising Lava gamemode, with environment automation and persistent win scores.

## Install
`omegga install gh:Kodi022/kRisingLava`

Create a minigame

Start plugin
   If the plugin starts with no minigame running and the plugin didnt die, you can do 
   /lava start, but you need auth

## Usage
Commands should NOT BE NECESSARY for the gamemode to function but there are two, both requiring auth

/lava (option)
   
   (start) : starts the rising lava gamemode, requires ONE minigame
   
   (stop) : pauses the rising lava gamemode
   
   (reset) : resets the environment to gamemode's defaults

/lavasetwins (name) (number)
   will set a given players wins to a given number (probably doesnt work)

## Possible bugs/issues
   - can semi-rarely run into random errors that shut plugin off
   - Commands may not actually help
   - Could bug with multiple minigames
   - If cpu is too slow it could miss minigame data updates
   - The water can definitely get too fast 2+ minutes in, but you shouldnt usually be alive at that point anyway


