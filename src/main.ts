import "./style.css";
import { fromEvent, interval, } from 'rxjs';
import { map, filter, scan, merge, } from 'rxjs/operators';

// Types
type Body = Readonly<{
  x: number
  y: number
  property: string
  id: string
}>

type ViewType = 'frog' | 'plant' | 'car' | 'Rcar' | 'crocodile'| 'crocodileHead' | "home"

type State = {
  readonly frog: Body
  readonly plant: Array<Rect>
  readonly car: Array<Rect>
  readonly crocodile: Array<Rect>
  readonly home: Array<Home>
  readonly gameOver: boolean
  readonly score: number
  readonly highestScore: number
  readonly checkWin: boolean
  readonly level: number,
  readonly RNG: RNG,
  Fly: number
}

// Interface extended
interface Home extends Body{
  readonly height: number
  readonly width: number
  reached: boolean
  fly: boolean
}

interface Rect extends Body{
  readonly height: number
  readonly width: number
  readonly velocity: number
}

class RNG {
  // LCG using GCC's constants
  m = 0x80000000// 2**31
  a = 1103515245
  c = 12345
  state:number
  constructor(seed: number) {
    this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
  }
  nextInt() {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state;
  }
  nextRange(max: number) {
    // returns in range [0,1]
    return Math.floor(max * (this.nextInt() / (this.m - 1)));
  }
  next() {
    return new RNG(this.nextInt())
  }
}

// method for creating bodies

const createCrocodile = (head: boolean)=> (height: number, width: number)=> 
(x: number)=> (y: number)=> (id: number)=> <Rect>{
  property: head? 'crocodileHead' :'crocodile',
  id: "crocodile"+ String(id),
  x: x,
  y: y,
  velocity: 1,
  height: height,
  width: width,
  head: head,
}

const createRect = (name: ViewType)=> (height: number, width: number)=> 
(x: number)=> (y: number)=> (id: number)=> (velocity: number)=><Rect>{
  property: name,
  id: name + id,
  x: x,
  y: y, 
  velocity: velocity,
  height: height,
  width: width
}
const createHome = (x: number, y: number, id: number) =><Home>{
  property: "home",
  id: "home" + String(id),
  x: x,
  y: y,
  height: 50,
  width: 96,
  reached: false
}

function createPlant(x:number, y:number, w:number, n: number, v: number): Rect{
  return createRect('plant')(50,w)(x)(y)(n)(v)
}
function createCar(x:number, y:number, n: number, v: number): Rect{
  const c = v>0? 'car' : 'Rcar' 
  return createRect(c)(50,50)(x)(y)(n)(v)
}

// default bodies in the initial state
const startHome = [createHome(20,50,1), createHome(136,50,2),createHome(252,50,3),createHome(368,50,4),createHome(484,50,5)]

const startPlants = [createPlant(-100,150,400,1,-2),createPlant(50,250,125,2,-1),createPlant(300,250,125,3,-1), createPlant(550,250,125,4,-1)]

const startCar = [createCar(550,500,1,1),createCar(250,500,2,1), createCar(200,400,3,1), createCar(400,400,4,1), createCar(600,400,6,1), 
  createCar(100,450,7,-2), createCar(600,350,8,-2), createCar(300,350,9,-2)  ]

const startCrocodile = [createCrocodile(true)(50,50)(100)(100)(1), createCrocodile(false)(50,100)(0)(100)(2), createCrocodile(true)(50,50)(700)(100)(3), createCrocodile(false)(50,100)(600)(100)(4),
  createCrocodile(true)(50,50)(150)(200)(5), createCrocodile(false)(50,100)(50)(200)(6), createCrocodile(true)(50,50)(750)(200)(7), createCrocodile(false)(50,100)(650)(200)(8),
  createCrocodile(true)(50,50)(450)(200)(9), createCrocodile(false)(50,100)(350)(200)(10), createCrocodile(true)(50,50)(400)(100)(11), createCrocodile(false)(50,100)(300)(100)(12)
  ]
/**
 * the initial state that constructe the game
 */
const initialState: State = {

  frog: { property: "frog", id: "frog", x: 300, y: 575},
  plant: startPlants,
  car: startCar,
  crocodile: startCrocodile,
  home: startHome,
  gameOver: false,
  score: 0,
  highestScore: 0,
  checkWin: false,
  level: 1,
  Fly: -1,
  RNG: new RNG(Math.floor(100*Math.random())),
}
/**
 * function for plant moving
 * @param state current state
 * @returns new state after plant moved
 */
function plantMove(state: State): State {
  const Bound = state.plant.map((p) => (p.x < -p.width? {...p, x : 600}: p))
  const c = state.crocodile.map((p) => (p.x > 750 ? {...p, x : -150}: p))
  
  return <State>{
    ...state,
    plant: Bound.map((e)=>({...e, x: (e.x + e.velocity + -0.4*(state.level - 1))})),
    crocodile: c.map((e)=>({...e, x: (e.x + e.velocity + 0.4*(state.level - 1))}))
  
  }
}
/**
 * function for car moving
 * @param state current state
 * @returns new state after car moved
 */
function carMove(state: State): State {
  
  const Bound = state.car.map((p) => p.velocity > 0 ?(p.x > 600? {...p, x : -25}: p):  (p.x < -25? {...p, x : 600}: p) )
  
  return <State>{
    ...state,
    car: Bound.map((e)=>({...e, x: (e.x + e.velocity + (e.velocity > 0? 0.4*(state.level - 1): -0.6*(state.level - 1)))}))
    
  }
}
/**
 * function for the frog moving
 * @param state current state
 * @param vertical vertical movement
 * @param horizonal horizonal movement
 * @returns new state after frog moved
 */
function frogMove(state: State, vertical: number, horizonal: number): State{
  const scoreGain = vertical === 0 ? (horizonal < 0 ? 5 : -5) : 0
  const Bound = {...state.frog, x: state.frog.x + vertical, y: state.frog.y + horizonal } 
  if (Bound.x <= 20 || Bound.x > 575){
    return {
      ...state,
      frog: state.frog
      }  
    }
  
  else if (Bound.y <= 50 || Bound.y > 600){
    return{
      ...state,
    score: state.score,
    frog: state.frog
    }
  }

  return <State>{
    ...state,
    score: state.score + scoreGain,
    frog: Bound
  }
}
/**
 * function for handle all kinds of collision
 * @param state current state
 * @returns new state after collided
 */
const handleCollisions = (state: State): State => {
  
  const bodiesCollided = ([body1,body2]:[Body,Body]) =>  body2.x - body1.x < 75 && body1.x - body2.x < 25 && body1.y === body2.y - 25
  const bodiesContained = ([body1,body2]:[Body,Body]) => (l: number) => body2.x - body1.x < l && body2.x - body1.x > 25 && body1.y === body2.y - 25
  const carCollided = state.car.filter(c => bodiesCollided([c,state.frog])).length > 0
  
  if(carCollided) {return <State>{...state,gameOver: true}}
  // Collisions in water section
  if(state.frog.y <= 300 && state.frog.y>= 125){
    const crocodileCollided = state.crocodile.filter(c => c.property === 'crocodileHead').filter(c => bodiesCollided([c,state.frog])).length > 0
    if(crocodileCollided) {return <State>{...state,gameOver: true}}

    const plantContained = state.plant.filter(c => bodiesContained([c,state.frog])(c.width-25))
    if(plantContained.length > 0){
      return frogMove(state,plantContained[0].velocity,0)}

    const crocodileContained = state.crocodile.filter(c => c.property === 'crocodile').filter(c => bodiesContained([c,state.frog])(c.width-25))
    if(crocodileContained.length > 0){
      return frogMove(state,crocodileContained[0].velocity,0)}
      
    return <State>{...state,gameOver: true}
    
  //Collisions in home section
  }else if (state.frog.y < 100){

    const homeContained = state.home.filter(c => bodiesContained([c,state.frog])(c.width-25))
    if(homeContained.length > 0){

      const h = state.home[parseInt(homeContained[0].id.slice(-1))-1]

      if(h.fly){
        return <State>{...state,gameOver: true}

      }else if( !h.reached){
        h.reached = true
        const win = state.home.filter(r => r.reached).length === 5? true : false
        
        return <State>{
          ...state,
          score: state.score + 50,
          checkWin: win,
          frog: {...state.frog, x:300, y:575 }
        }
      }
    }else{
      return <State>{...state,gameOver: true}
    }
  }
  return state
}

/**
 * Interval tick
 * @param state current state
 * @param elapsed time
 * @returns go to handleCollisions
 */
const tick = (state: State, elapsed: number): State => {
  const highestScore = state.score > state.highestScore ? state.score : state.highestScore
  if(state.Fly === -1){
    const n = state.home.filter(c => c.reached === false)
    const rand = state.RNG.nextRange(n.length)
    state.Fly = parseInt(n[rand].id.slice(-1))-1  
  }

  
  if (elapsed % 2000 === 0){
    state.home[state.Fly].fly = true
  }else if (elapsed % 1000 === 0){
    state.home[state.Fly].fly = false}
    const s = {...state, highestScore: highestScore, RNG: state.RNG.next() }
  return handleCollisions(s)
}

//Classes
class Tick { constructor(public  elapsed: number) { } }
class FrogMove {constructor(public  vertical: number, public horizonal: number) { } }
class PlantMove { constructor() { } }
class CarMove { constructor() { } }
class Restart { constructor() { } }

/**
 * State Transducer
 * @param state Giving the init state
 * @param event Check the typy of event
 * @returns generate a state
 */
const reduceState = (state: State, event: Tick|FrogMove|PlantMove|CarMove|Restart)=>
state.checkWin ? 
{...initialState, 
  level: state.level + 1,
  score: state.score,
  home: startHome.map((h)=>({...h, reached : false}))
} : 
event instanceof Restart ? {...initialState, home: startHome.map((h)=>({...h, reached : false})), highestScore: state.highestScore}:
state.gameOver ? state :
event instanceof FrogMove ? frogMove(state, event.vertical, event.horizonal):
event instanceof PlantMove ? plantMove(state) :
event instanceof CarMove ? carMove(state):
tick(state, event.elapsed)

const attr = (e:Element, o:{ [key:string]: Object }) =>
      { for(const k in o) e.setAttribute(k,String(o[k])) }

function main() {
    
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  // Initialise following obervables for keyboard events
  const PlantMove$ = interval(10).pipe(map((_)=> new PlantMove()))
  const CarMove$ = interval(10).pipe(map((_)=> new CarMove()))
  const key = fromEvent<KeyboardEvent>(document, "keydown")
  const Left$ = key.pipe(filter(({code}) => code == "ArrowLeft")).pipe(map(() => new FrogMove(-50,0)))
  const Right$ = key.pipe(filter(({code}) => code == "ArrowRight")).pipe(map(() => new FrogMove(50,0)))
  const Up$ = key.pipe(filter(({code}) => code == "ArrowUp")).pipe(map(() => new FrogMove(0,-50)))
  const Down$ = key.pipe(filter(({code}) => code == "ArrowDown")).pipe(map(() => new FrogMove(0,50)))
  const Restart$ = key.pipe(filter(({code}) => code == "KeyR")).pipe(map(() => new Restart()))
  // Adding elements to svg screen
  const s = document.createElementNS(svg.namespaceURI, "text");
  attr(s,{id:"score", x:10, y:20, class:"text"})
  svg.appendChild(s)

  const h = document.createElementNS(svg.namespaceURI, "text");
  attr(h,{id:"highest", x:200, y:20, class:"text"})
  svg.appendChild(h)

  const l = document.createElementNS(svg.namespaceURI, "text");
  attr(l,{id:"level", x:500, y:20, class:"text"})
  svg.appendChild(l)
  
  const f = document.createElementNS(svg.namespaceURI, "circle");
  attr(f,{id:"frog", r:25, style: "fill: green; stroke: yellow; stroke-width: 1px;"})
  svg.appendChild(f)
  // Main gameClock observable
  interval(10).pipe(map(elapsed => new Tick(elapsed)),
  merge(PlantMove$,CarMove$,Left$,Right$,Up$,Down$,Restart$),
  scan(reduceState, initialState)).subscribe((_) => {update(_)})
  /**
   * Updating all the bodies in game and shown in SVG 
   * @param state current state
   */
  function update(state:State) {
    
    s.innerHTML = `Score: ${state.score}`
    h.innerHTML = `Highest Score: ${state.highestScore}`
    l.innerHTML = `Level: ${state.level}`
    
    f.setAttribute("cx", `${state.frog.x}`)
    f.setAttribute("cy", `${state.frog.y}`)
    
    
    if(state.gameOver) {
      const g = document.getElementById("gameover");
      if(!g){
        
        const g = document.createElementNS(svg.namespaceURI, "text");
        attr(g, { id: "gameover" ,x: 100,y: 300, class: "gameover",})
        g.textContent = "Game Over";
        svg.appendChild(g)
      }

    }else {
      // unsubscribe when restart
      const g = document.getElementById("gameover");
      if (g) 
        {svg.removeChild(g)}
    }
    /**
     * Create a rect svg element with colors by its property
     * @param rect a rect body 
     */
    const viewRect = (rect: Rect) =>{
      function appearance(){
          const e = document.createElementNS(svg.namespaceURI, "rect")
          attr(e,{id: rect.id, width: rect.width, height: rect.height, x: rect.x, y: rect.y})
          if(rect.property === "plant"){
            e.setAttribute("style", "fill: chocolate; stroke: yellow; stroke-width: 1px; opacity: 0.75");
          }else if (rect.property === "crocodile") {
            e.setAttribute("style", "fill: yellowgreen; stroke: yellow; stroke-width: 1px; opacity: 0.75");
          }else if (rect.property === "crocodileHead") {
            e.setAttribute("style", "fill: darkred; stroke: yellow; stroke-width: 1px; opacity: 0.75");
          }else if (rect.property === "car"){
            e.setAttribute("style", "fill: cyan; stroke: yellow; stroke-width: 1px;");
          }else{
            e.setAttribute("style", "fill: crimson; stroke: yellow; stroke-width: 1px;");
          }
          svg.appendChild(e)
          return e
      }
      const e = document.getElementById(rect.id) || appearance();
      attr(e,{x: rect.x, y: rect.y})
    }
    /**
     * Create the home bodies with colors by its state
     * @param home a home body
     */
    const viewHome = (home: Home) =>{
      function appearance(){
        const e = document.createElementNS(svg.namespaceURI, "rect")
        attr(e,{id: home.id, width: home.width, height: home.height, x: home.x, y: home.y, style: "fill: blue; opacity: 0.75"})
        svg.appendChild(e)
          return e
      }
      const e = document.getElementById(home.id) || appearance();
      attr(e,{x: home.x, y: home.y})
      
      if(home.reached){
        e.setAttribute("style", "fill: green;");
      }else if (home.fly){
        e.setAttribute("style", "fill: red; opacity: 0.75");
      }else{
        e.setAttribute("style", "fill: blue; opacity: 0.75");
      }
    }

    state.home.forEach(viewHome)
    state.plant.forEach(viewRect)
    state.car.forEach(viewRect)
    state.crocodile.forEach(viewRect)
  }
}  
    
    
// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

