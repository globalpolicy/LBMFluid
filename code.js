'use strict';
var animate = false;

const canvasWidth = 800, canvasHeight = 400;
const dx = 20, dy = 20;
var inflowVel = [0.24, 0];
const startWithZeroVel = false; //initial velocity of the control domain
var viscosity = 1.46;
var c = 1;
var debugCell;
var prevGridSolidsInfo; //for keeping track of solids between start and stop of simulations

var grid = []; //matrix of the entire grid

class Cell {
    constructor(isSolid, x, y, u, rho) {
        this.directions = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]]; //unit vectors 'e' in order: rest,E,N,W,S,NE,NW,SW,SE
        this.weights = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36]; //weights 'w' for equilibrium particle distribution calculation

        this.x = x; //cell's top left corner's x coordinate
        this.y = y; //cell's top left corner's y coordinate
        this.velocity = [...u]; //macroscopic velocity of this cell's particles
        this.rho = rho; //macroscopic density of this cell
        this.isSolid = isSolid;

        this.distribution = [0, 0, 0, 0, 0, 0, 0, 0, 0]; //particle distribution 'f' in order: rest,E,N,W,S,NE,NW,SW,SE

        if (this.isSolid) return; //don't need any calculation for solid(dead cell)

        //initialize particle distribution to the equilibrium distribution according to fluid density and velocity
        for (let i = 0; i < 9; i++) {
            let f_i_eq = this.getEquilibriumDistribution_(i);
            this.distribution[i] = f_i_eq;
        }
    }


    relax() {
        if (this.isSolid)
            return;
        for (let i = 0; i < 9; i++) {
            let f_i_eq = this.getEquilibriumDistribution_(i);
            this.distribution[i] = this.distribution[i] - viscosity * (this.distribution[i] - f_i_eq);
        }
    }

    calculateMacros() {
        //computes the macroscopic properties : the density and fluid velocity in this cell
        if (this.isSolid)
            return;
        this.rho = 0;
        this.distribution.forEach(f => {
            this.rho += f;
        });

        this.velocity = [0, 0];
        this.distribution.forEach((f, index) => {
            let dirxn = this.directions[index]; //direction vector 'e' corresponding to this distribution
            this.velocity[0] += dirxn[0] * f;
            this.velocity[1] += dirxn[1] * f;
        });
        this.velocity[0] /= this.rho;
        this.velocity[1] /= this.rho;
    }

    DotProduct_(ar1, ar2) {
        let final = 0;
        for (let i = 0; i < ar1.length; i++) {
            final += ar1[i] * ar2[i];
        }
        return final;
    }

    getEquilibriumDistribution_(dirxnIndex) {
        let eDotU = this.DotProduct_(this.directions[dirxnIndex], this.velocity);
        let term1 = 3 / (c * c) * eDotU;
        let term2 = 9 / 2 * eDotU * eDotU / (c * c * c * c);
        let term3 = -3 / 2 * (this.velocity[0] * this.velocity[0] + this.velocity[1] * this.velocity[1]) / (c * c);

        let f_i_eq = this.weights[dirxnIndex] * this.rho * (1 + term1 + term2 + term3);
        return f_i_eq;
    }

}

function changeInflowVel(newVelX) {
    inflowVel[0] = newVelX;
    for (let i = 1; i < grid.length - 1; i++) {
        grid[i][1] = new Cell(false, 2 * dx, (i + 1) * dy, inflowVel, 1);

    }
}

function start() {
    setup();
    initGrid();
    animate = true;
}

function stop() {
    animate = false;
}

function resume() {
    animate = true;
}

function clearSolids() {
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[0].length; j++) {
            let cell = grid[i][j];
            cell.isSolid = false;
        }
    }
    prevGridSolidsInfo = []; //clear solids info
}

function setup() {
    clear();
    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent("container");
    canvas.mouseMoved(mouseDraggedFn);
    canvas.mouseReleased(mouseReleasedFn);
    background("pink");
    document.getElementById("container").addEventListener("contextmenu", (mouseevent) => {
        mouseevent.preventDefault();
    });
    frameRate(60);
}

function draw() {
    if (animate) {
        cycle();
    }

}

function keyPressed() {
    if (keyCode == 32) { //space pressed
        cycle();
    }
}

function cycle() {
    step();
    paintInfo();
}

function mouseReleasedFn(event) {
    if (event.button == 2) { //right click
        debugCell = getCellFromPos(mouseX, mouseY);

        let div = document.getElementById("cellInfo");
        let text = `Velocity: (${debugCell.velocity[0].toFixed(3)}, ${debugCell.velocity[1].toFixed(3)})
        Density: ${debugCell.rho.toFixed(3)}
        Distributions: ${debugCell.distribution.map(val => val.toFixed(3))}`;
        div.innerText = text;
    }
}

function mouseDraggedFn() {
    if (mouseIsPressed) {
        let clickedCell = getCellFromPos(mouseX, mouseY);
        clickedCell.isSolid = true;
        prevGridSolidsInfo = _.cloneDeep(grid); //update the solids info
    }
}

function getCellFromPos(posx, posy) {
    let mousepos = createVector(posx, posy);
    let minDist = 999;
    let clickedCell;
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[0].length; j++) {
            let cell = grid[i][j];
            let centroid = createVector(cell.x + dx / 2, cell.y + dy / 2);
            let dist = centroid.dist(mousepos);
            if (dist < minDist) {
                minDist = dist;
                clickedCell = cell;
            }
        }
    }
    return clickedCell;
}



function paintInfo() {
    // //find max and min speed in the (interior) grid
    // let maxspeed = 0;
    // let minspeed = 99999;
    // for (let i = 1; i < grid.length - 1; i++) {
    //     for (let j = 1; j < grid[0].length - 1; j++) {
    //         let cell = grid[i][j];
    //         if (cell.isSolid)
    //             continue;
    //         let speed = cell.velocity.mag();
    //         if (speed > maxspeed) {
    //             maxspeed = speed;
    //         }
    //         if (speed < minspeed) {
    //             minspeed = speed;
    //         }
    //     }
    // }

    // console.log("min vel=" + minspeed);
    // console.log("max vel=" + maxspeed);

    //paint (interior) grid cells according to their velocity
    for (let i = 1; i < grid.length - 1; i++) {
        for (let j = 1; j < grid[0].length - 1; j++) {
            let cell = grid[i][j];
            if (cell.isSolid) {
                fill('grey');
            }
            else {
                let speed = Math.sqrt(cell.velocity[0] * cell.velocity[0] + cell.velocity[1] * cell.velocity[1]);
                let red = map(speed, 0, inflowVel[0], 0, 255);
                fill(red, 0, 255 - red);
            }

            rect(cell.x, cell.y, dx, dy);
            //circle(cell.x + dx / 2, cell.y + dy / 2, 2); //show lattice points

            //also draw direction vectors
            let vel_copy = [...cell.velocity];
            vel_copy[1] = -vel_copy[1]; //invert velocity's y comp. computer's y axis is opposite that of the direction vectors e's
            let mag = Math.sqrt(vel_copy[0] * vel_copy[0] + vel_copy[1] * vel_copy[1]);
            vel_copy[0] /= mag;
            vel_copy[1] /= mag;
            vel_copy[0] *= dx;
            vel_copy[1] *= dx;
            let startX = cell.x, startY = cell.y + dy / 2;
            strokeWeight(0.5);
            line(startX, startY, startX + vel_copy[0], startY + vel_copy[1]);
        }
    }


    //update debug info for selected cell
    if (debugCell != null) {
        let div = document.getElementById("cellInfo");
        let text = `Velocity: (${debugCell.velocity[0].toFixed(3)}, ${debugCell.velocity[1].toFixed(3)})
        Density: ${debugCell.rho.toFixed(3)}
        Distributions: ${debugCell.distribution.map(val => val.toFixed(3))}`;
        div.innerText = text;
    }

}


function initGrid() {
    grid = [];
    let defaultVel = [0, 0];
    let vel = defaultVel;

    let nx = Math.floor(width / dx), ny = Math.floor(height / dy);
    //draw the grid
    strokeWeight(0.2);
    for (let i = 0; i < nx; i++) {
        line(i * dx, 0, i * dx, height);
    }
    for (let i = 0; i < ny; i++) {
        line(0, i * dy, width, i * dy);
    }

    for (let j = 1; j < ny - 1; j++) { //iterate through rows
        let row = [];
        for (let i = 1; i < nx - 1; i++) { //iterate through columns
            let x = i * dx, y = j * dy;
            let isSolid = false;
            if (i == 1 || i == nx - 2 || j == 1 || j == ny - 2) { //boundaries
                fill('green'); //fill boundary cells as green
                vel = defaultVel;
            }
            else {
                fill('grey'); //fill interior cells as grey
                vel = startWithZeroVel ? defaultVel : inflowVel;
            }
            if (i == 2 && j > 1 && j < ny - 2) { //first interior column
                fill('red'); //fill as red. will have inflow velocity
                vel = inflowVel;
            }
            if (prevGridSolidsInfo != null && prevGridSolidsInfo.length > 0) {
                let oldCell = prevGridSolidsInfo[j - 1][i - 1];
                if (oldCell != null) {
                    isSolid = oldCell.isSolid;
                }
            }

            let cell = new Cell(isSolid, x, y, vel, 1);
            row.push(cell);

            rect(x, y, dx, dy);
            circle(x + dx / 2, y + dy / 2, 2); //show lattice points
        }
        grid.push(row);
    }
    noFill();

    // //debug code
    for (let i = 6; i <= 11; i++) {
        grid[i][7].isSolid = true;
    }
    //


}


function step() {

    //relaxation(collision) step
    for (let i = 1; i < grid.length - 1; i++) { //loop through rows of interior cells
        for (let j = 1; j < grid[0].length - 1; j++) { //loop through columns of interior cells
            let cell = grid[i][j];

            cell.relax();
        }
    }

    //propagation(streaming) step
    let originalGrid = _.cloneDeep(grid);
    propagate2(originalGrid, grid);

    //update each cell's macroscopic variables
    for (let i = 1; i < grid.length - 1; i++) { //loop through rows of interior cells
        for (let j = 1; j < grid[0].length - 1; j++) { //loop through columns of interior cells
            let cell = grid[i][j];
            cell.calculateMacros();
        }
    }

}


function propagate2(originalGrid, newGrid) {
    //uses stream-in approach i.e. each cell draws distributions from its neighbors
    for (let i = 1; i < originalGrid.length - 1; i++) { //rows
        for (let j = 2; j < originalGrid[0].length - 2; j++) { //columns
            let cell = newGrid[i][j];
            let above = i - 1, below = i + 1, right = j + 1, left = j - 1;

            if (i == 1) above = originalGrid.length - 2; //loop back to bottom
            if (i == originalGrid.length - 2) below = 1; //loop back to top
            if (!cell.isSolid) {
                cell.distribution[1] = originalGrid[i][left].isSolid ? cell.distribution[3] : originalGrid[i][left].distribution[1];
                cell.distribution[2] = originalGrid[below][j].isSolid ? cell.distribution[4] : originalGrid[below][j].distribution[2];
                cell.distribution[3] = originalGrid[i][right].isSolid ? cell.distribution[1] : originalGrid[i][right].distribution[3];
                cell.distribution[4] = originalGrid[above][j].isSolid ? cell.distribution[2] : originalGrid[above][j].distribution[4];
                cell.distribution[5] = originalGrid[below][left].isSolid ? cell.distribution[7] : originalGrid[below][left].distribution[5];
                cell.distribution[6] = originalGrid[below][right].isSolid ? cell.distribution[8] : originalGrid[below][right].distribution[6];
                cell.distribution[7] = originalGrid[above][right].isSolid ? cell.distribution[5] : originalGrid[above][right].distribution[7];
                cell.distribution[8] = originalGrid[above][left].isSolid ? cell.distribution[6] : originalGrid[above][left].distribution[8];
            }
        }
    }
    //for last interior column, simply copy distributions of the immediate left column
    for (let i = 1; i < originalGrid.length - 1; i++) {
        let finalInteriorCol = originalGrid[0].length - 2;
        newGrid[i][finalInteriorCol].distribution = originalGrid[i][finalInteriorCol - 1].distribution;
    }

}

//distribution array order: rest,E,N,W,S,NE,NW,SW,SE