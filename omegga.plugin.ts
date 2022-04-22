import OmeggaPlugin, { OL, PS, PC, IPlayerPositions, OmeggaPlayer } from 'omegga';
type Config = { foo: string };
type Storage = { bar: string };

export default class kRisingLava implements OmeggaPlugin<Config, Storage> 
{
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;
  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) 
  {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() 
  {
    const auth = this.config["Authorized-Users"];
    const roundEndWait:number = this.config["Wait-Between-Rounds"]*1000;
    const waterSpeedScale:number = this.config["Water-Speed-Scale"];
    const waterStartHeight:number = this.config["Water-Start-Height"];
    const lastManStand:boolean = this.config["Plugin-Last-Man-Standing-Restart"];
    const countWinsNum:number = this.config["Count-Wins-Min-Players"];
    const debug = this.config["Enable-Debug"];
    let running:boolean = false;
    
    this.omegga.on('cmd:lava', async (name, value) => 
    {
      if (auth.find(p => p.name == name)) 
      {
        switch (value) 
        {
          case 'start':
            this.omegga.broadcast('Starting');
            await Begin();
            break;
          case 'stop':
            this.omegga.broadcast('Stopping');
            running = false;
            break;
          case 'reset':
            LoadStartEnv();
            break;
          default:
            this.omegga.whisper(name, 'write <code>/lava start</> or <code>/lava stop</> or <code>/lava reset</>');
            break;
        }
      } else 
      {
        this.omegga.whisper(name, 'You are not authorized');
      }
    })
    this.omegga.on('cmd:lavasetwins', async (name, value, value2:number) => 
    {
      if (auth.find(p => p.name == name))
      {
        let nam:OmeggaPlayer = this.omegga.findPlayerByName(value);
        let a = await this.store.get<any>(nam.name);
        if (a != null) 
        {
          a.wins = value2;
          this.store.set<any>(nam.name, a);
          this.omegga.whisper(name, `Set ${nam.name}'s wins to ${value2}`);   
        } else 
        {
          this.omegga.whisper(name, "Player not found");       
        }
      }
    })

    let m = await this.omegga.getMinigames();
    if (m.length < 2) 
    {
      console.warn("No minigame was found, start minigame then restart plugin or try /lava start");
      this.omegga.broadcast("No minigame was found, start minigame then restart plugin or try /lava start");
      return { registeredCommands: ['lava', 'lavasetwins'] };
    }

    // ran at start of each round, then loops RisingLoop() until end conditions are met, and returns here
    const Begin = async () =>
    {
      let minigame = (await this.omegga.getMinigames()).filter(m => m.name !== 'GLOBAL');
      if (minigame.length == 1) 
      {
        running = true;
        tick = 0;
        time = (Math.random() * 11) + 6.5;
        angle = Math.random() * 360
        LoadStartEnv();
        await GetEndCondition();
        await GetAlivePlayers();
        await RisingLoop();
      } else 
      {
        this.omegga.broadcast('Rising Lava requires a running minigame!');
        return;
      }
    }

    let tick:number = 0;
    let minigamePlayers:number = 0;
    let alivePlayers = [];
    let aliveNumber:number = 1; // how many players may be alive at end of round
    let angle:number = 0; // random sun angle each round
    let time:number = 0; // random hour between 6.5 and 17.5 each round
    let flagButton = 0; // unused, will allow someone who reaches end of map to end round with button and get a special win
    const RisingLoop = async () => 
    {
      let waterLevel:number = (((tick ** 1.5) * 0.1) + waterStartHeight) * waterSpeedScale;
      let colorChange:number = Math.min((tick / 1500) + 0.01, 1);
      let colorChangeInverted:number = 1 - colorChange;

      if (tick % 15 == 0 || tick == 5) await GetAlivePlayers();

      if (alivePlayers.length > aliveNumber)
      {
        if (debug) console.log(`alive: ${alivePlayers.length}, tick: ${tick}`);
        if (tick % 2 == 0) 
        {
          this.omegga.loadEnvironmentData({data:{groups:{Water:{waterHeight:waterLevel}}}});
        }
        if (tick % 5 == 0)
        {
          this.omegga.loadEnvironmentData({data:{groups:{
                Sky:{skyColor:{r:1,g:colorChangeInverted,b:colorChangeInverted,a:1},
                fogColor:{r:0.5,g:colorChangeInverted * 0.6,b:colorChangeInverted * 0.6,a:1},
                sunlightColor:{r:0.65,g:colorChangeInverted * 0.6,b:colorChangeInverted * 0.6,a:1},
                timeOfDay:time,
                sunAngle:angle}}}});
        }
      } else 
      {
        running = false;
        if (!lastManStand && alivePlayers.length != 0 && aliveNumber == 1) 
        {
          if (minigamePlayers >= countWinsNum) 
          {
            if (alivePlayers[0] != undefined)
            {
              let plrStore = await this.store.get(alivePlayers[0].name);
              if (plrStore == null) 
              {
                this.store.set(alivePlayers[0].name, {wins:1, flagWins:0});
                this.omegga.broadcast(`<size="28">${alivePlayers[0].name} is the last alive! This is their first win!</>`);
              } else 
              {
                plrStore.wins += 1;
                this.omegga.broadcast(`<size="28">${alivePlayers[0].name} is the last alive! ${plrStore.wins} wins</>`);
                this.store.set(alivePlayers[0].name, plrStore);
              }
            } else 
            {
              this.omegga.broadcast(`<size="10">Had an error... sorry...</>`);
            }
          } else 
          {
            this.omegga.broadcast(`<size="12">At least ${countWinsNum} players required to count wins</>`);
          }
        } else 
        {
          if (minigamePlayers < countWinsNum) 
          {
            this.omegga.broadcast(`<size="12">At least ${countWinsNum} players required to count wins</>`);
          }
        }

        if (alivePlayers.length == 1) this.omegga.nextRoundMinigame(0);
        LoadStartEnv();
        setTimeout(async () => 
        {
          await Begin();
          return;
        }, roundEndWait);
      }
      tick++;
      if (running) setTimeout(async () => {await RisingLoop();}, 100);
    }


   // gets amount of players in minigame, and lists all alive ones
    const GetAlivePlayers = async ()  => //writes into alivePlayers
    {
      let p_s = [];
      let ming = (await this.omegga.getMinigames()).filter(m => m.name !== 'GLOBAL');
      if (ming.length == 1) 
      {
        let mingplr = ming[0].members;
        minigamePlayers = ming[0].members.length;
        let fullplrList:IPlayerPositions = await this.omegga.getAllPlayerPositions();
        for (let p of fullplrList) 
        {
          if (p != undefined) 
          {
            if (mingplr.find(e => e.name == p.player.name)) 
            {
              if (!p.isDead) p_s.push(p.player);
            }
          }
        }
        alivePlayers = p_s;
      }
    }
    // gets amount of players in minigame, if only one then disable one left win condition
    const GetEndCondition = async () => // writes to aliveNumber
    {
      let ming = (await this.omegga.getMinigames()).filter(m => m.name !== 'GLOBAL');
      if (ming.length == 1) 
      {
        let mingplr = ming[0].members;
        (mingplr.length < 2) ? aliveNumber = 0 : aliveNumber = 1;
      } else 
      {
        console.error("Minigame not found, function took too long");
      }
    }
    // just the environment for the start of a round
    const LoadStartEnv = () => 
    {
      if (debug) console.log(`Loading start env`);
      this.omegga.loadEnvironmentData({data:{groups:
        {Water:{waterHeight:waterStartHeight},
        Sky:{skyColor:{r:1,g:1,b:1,a:1},sunlightColor:{r:1,g:1,b:1,a:1}}}}});
    }

    await Begin();
    return { registeredCommands: ['lava', 'lavasetwins'] };
  }

  async stop() { }
}