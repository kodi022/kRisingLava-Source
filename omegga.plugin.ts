import OmeggaPlugin, { OL, PS, PC, IPlayerPositions, OmeggaPlayer, BrickInteraction } from 'omegga';
type Config = { foo: string };
type Storage = { bar: string };

export default class kRisingLava implements OmeggaPlugin<Config, Storage> 
{
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;
  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store; }

  async init() 
  {
    const auth = this.config["Authorized-Users"];
    const roundEndWait:number = this.config["Wait-Between-Rounds"]*1000;
    const waterSpeedScale:number = this.config["Water-Speed-Scale"];
    const waterStartHeight:number = this.config["Water-Start-Height"];
    const exponential:boolean = this.config["Exponential-Water"];
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
            tick = 0;
            running = false;
            await Begin();
            break;
          case 'clear':
            await this.store.wipe();
            this.omegga.broadcast('Cleared saved wins');
          default:
            this.omegga.whisper(name, 'write <code>/lava (option)</>');
            this.omegga.whisper(name, 'options are: start, stop, reset, clear</>');
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

    const search_mini = async () => 
    {
      let ming = await this.omegga.getMinigames();
      if (ming.length < 2) 
      {
        console.log("No minigame was found");
        this.omegga.broadcast("No minigame was found");
      }
    }
    setTimeout(async () => {await search_mini(); return;}, 10000)

    // ran at start of each round, then loops RisingLoop() until end conditions are met, and returns here
    const Begin = async () =>
    {
      let ming = await this.omegga.getMinigames();
      if (ming && ming.length > 1) // getMinigames() is very hit and miss, supposed to return the mini and GLOBAL
      {
        ming = ming.filter(m => m.name !== 'GLOBAL')
        if (debug) console.info('Beginning');
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
        if (debug) console.warn('No running minigame or getMinigame failed!');
        return;
      }
    }

    let tick:number = 0;
    let inactiveTick:number = 0;
    let minigamePlayers:number = 0;
    let alivePlayers = [];
    let aliveNumber:number = 1; // how many players may be alive at end of round
    let angle:number = 0; // random sun angle each round
    let time:number = 0; // random hour between 6.5 and 17.5 each round
    let interval:number;
    
    const RisingLoop = async () => 
    {
      interval = setInterval(async () => 
      {
        if (minigamePlayers == 0) 
        {
          inactiveTick++;
          if (inactiveTick % 15) await GetAlivePlayers();
          return;
        }
        let waterLevel:number = waterStartHeight;

        (exponential) 
        ? waterLevel = ((((tick ** 1.42) * 0.1) + waterStartHeight) + (tick * 0.5)) * waterSpeedScale
        : waterLevel = ((tick * 2) + waterStartHeight) * waterSpeedScale
  
        let colorChange:number = Math.min((tick / 1500) + 0.01, 1);
        let colorChangeInverted:number = 1 - colorChange;
  
        if (tick % 15 == 0 || tick == 3) await GetAlivePlayers();
  
        if (alivePlayers.length > aliveNumber)
        {
          if (debug) 
          {
            let string = "";
            (tick % 15 == 0) ? string = ", getting minigames" : string = "";
            console.info(`alive: ${alivePlayers.length}, tick: ${tick}` + string);
          }
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
        } else await EndCheck();
        tick++;    
      }, 100);
    };

    this.omegga.on('join', async () => // sanity function
    { 
      running = true;
    });
    this.omegga.on('interact', async (interact:BrickInteraction) => 
    {
      if (running) await EndCheck(interact.player.name);
    })

    const EndCheck = async (player?:string) => 
    {
      clearInterval(interval);
      running = false;
      tick = 0;
      if (alivePlayers.length > 0) this.omegga.nextRoundMinigame(0);
      this.omegga.loadEnvironmentData({data:{groups:{Water:{waterHeight:waterStartHeight}}}});
      setTimeout(async () => { await Begin(); }, roundEndWait);
      
      let lastplayername: string; 
      try {lastplayername = alivePlayers[0].name || null} catch {}

      let name: string = player || lastplayername  || null;  
      let string1: string = "";
      let string2: string = `<size="12">At least ${countWinsNum} players required to count wins</>`;

      if (name != null && minigamePlayers >= countWinsNum) 
      {
        let plrStore = await this.store.get<any>(name) || null;
        
        if (plrStore === null) 
        {
          this.store.set<any>(name, {wins:0, flagWins:0});
          plrStore = await this.store.get<any>(name)
        }

        if (player) 
        {
          string1 = `<size="28">${name} has hit the finish button!`;
          plrStore.wins += 1;
          plrStore.flagWins += 1;
          this.store.set<any>(name, plrStore);
        } else 
        {
          string1 = `<size="28">${name} is the last alive!`;
          plrStore.wins += 1;
          this.store.set<any>(name, plrStore);
        }

        if (plrStore.wins === 0) 
        {
          string2 = `This is their first win!</>`;
        } else 
        {
          (plrStore.flagWins === 0) 
          ? string2 = `${plrStore.wins} wins</>`
          : string2 = `${plrStore.wins} wins, ${plrStore.flagWins} Button wins </>`;
        }
      }
      this.omegga.broadcast(string1 + " " + string2);
    }



    // gets amount of players in minigame, and lists all alive ones
    const GetAlivePlayers = async ()  => //writes into alivePlayers
    {
      let p_s: OmeggaPlayer[] = [];
      let ming = await this.omegga.getMinigames();
      if (ming && ming.length > 1) 
      {
        ming = ming.filter(m => m.name !== 'GLOBAL');
        let mingplr = ming[0].members;
        minigamePlayers = ming[0].members.length;
        let fullplrList:IPlayerPositions = await this.omegga.getAllPlayerPositions();
        for (let p of fullplrList) 
        {
          if (mingplr.find(e => e.name === p.player.name) && !p.isDead) p_s.push(p.player);
        }
        alivePlayers = p_s;
      } else 
      {
        if (debug) console.warn('No running minigame or getMinigame failed!');
      }
    }
    // gets amount of players in minigame, if only one then disable one left win condition
    const GetEndCondition = async () => // writes to aliveNumber
    {
      let ming = await this.omegga.getMinigames();
      if (ming && ming.length > 1) 
      {
        ming = ming.filter(m => m.name !== 'GLOBAL')
        let mingplr = ming[0].members;
        (mingplr.length < 2) ? aliveNumber = 0 : aliveNumber = 1;
      } else 
      {
        if (debug) console.warn('No running minigame or getMinigame failed!');
      }
    }

    // just the environment for the start of a round
    const LoadStartEnv = () => 
    {
      if (debug) console.info(`Loading start env`);
      this.omegga.loadEnvironmentData({data:{groups:
        {Water:{waterHeight:waterStartHeight},
        Sky:{skyColor:{r:1,g:1,b:1,a:1},sunlightColor:{r:1,g:1,b:1,a:1}}}}});
    }

    running = true;
    await Begin();
    return { registeredCommands: ['lava', 'lavasetwins'] };
  }

  async stop() { }
}