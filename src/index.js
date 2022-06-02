import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import {levels, BLACK, WHITE} from './levels.js';
console.log(levels)

// Constants to represent the state of the grid.
// These are also displayed in the UI, in the squares.
const CROSS = "⨯";
const FILL = " ";
const EMPTY = null;

/**
 * Generic Square component.
 */
function Square(props) {
  const pseudoClick = event => {
    if (event.buttons == 1)
      props.onClick(event)
    else if (event.buttons == 2) {
      props.onContextMenu(event)
    }
  }
  return (
    <button className={`square ${props.classNames} `}
            onClick={props.onClick}
            onContextMenu={props.onContextMenu}
            onMouseOver={pseudoClick}
            onMouseDown={pseudoClick}
    >
      {props.value}
    </button>
  );
}

/**
 * Grid includes the space for the image to be guessed, and the margins with clues at the top and on the left.
 */
class Grid extends React.Component {

  subgridSize = 5;
  imageHeight = 15;
  imageWidth = 15;
  initialLives = 5;

  constructor(props) {

    super(props);

    // Compute the minimal margin sizes.
    this.rowClues = computeRowClues(props.level.squares)
    this.leftMargin = Math.max(...this.rowClues.map(x => x.length));

    this.colClues = computeColClues(props.level.squares)
    this.topMargin = Math.max(...this.colClues.map(x => x.length));

    // FIXME: images hardcoded to be 15x15
    this.state = {
      squares: Array(this.imageHeight + this.topMargin).fill(Array(this.imageWidth + this.leftMargin).fill(null)),
      errors: [],
      lives: this.initialLives
    };
  }

  /**
   * A left click fills a square with black.
   */
  handleLeftClick(imageY, imageX) {

    // Coordinates must be in range
    if (!inRange(imageY, this.imageHeight) || !inRange(imageX, this.imageWidth)) {
      return;
    }

    if (this.state.errors.containsArray([imageY, imageX]) || this.gameOver()) {
      return;
    }

    const squares = copy2d(this.state.squares);
    const errors = this.state.errors.slice();

    squares[imageY][imageX] = FILL;
    if (this.props.level.squares[imageY][imageX] == WHITE) {
      squares[imageY][imageX] = CROSS;
      // Save error coordinates in the state to highlight it in the UI.
      errors.push([imageY, imageX]);
    }

    this.setState({
      squares: squares,
      errors: errors,
      lives: this.initialLives - errors.length
    });
  }

  /** TODO: merge these two functions? */
  handleRightClick(imageY, imageX) {
     // Coordinates must be in range
    if (!inRange(imageY, this.imageHeight) || !inRange(imageX, this.imageWidth)) {
      return;
    }

    if (this.state.errors.containsArray([imageY, imageX])) {
      return;
    }

    const squares = copy2d(this.state.squares)

    switch (squares[imageY][imageX]) {
      case FILL:
        break;
      case CROSS:
        squares[imageY][imageX] = EMPTY;
        break;
      case EMPTY:
        squares[imageY][imageX] = CROSS;
    }

    this.setState({
      squares: squares,
    });
  }

  /**
   * Check if the game is over. The player either lost (lost all lives) or won.
   */
  gameOver() {
    return (this.state.lives === 0) || this.gameWon();
  }

  /**
   * Check is the game is won.
   *
   * Every square corresponding to a black square in the level must be filled.
   */
  gameWon() {
    return filter2d(this.props.level.squares, x => x == BLACK).every(coords => {
      const imageY = coords[0], imageX = coords[1];
      return this.state.squares[imageY][imageX] == FILL
    })
  }

  /**
   * Get game status
   */
  getStatus() {
    if (this.gameWon()) {
      return "You won!"
    }
    switch(this.state.lives) {
      case 0:
        return "Game over! You lost."
      case 1:
        return "1 life left. Choose wisely."
      default:
        return `${this.state.lives} lives left.`
    }
  }

  /**
   * Compute the class-names needed for subgrid highlighting, given grid coordinates (i, j).
   *
   * @return {Array.<string>} class names describing border properties of square at (i, j)
   */
  borderClassNames(i, j) {
    const names = []

    // In the margins, borders of certain directions are omitted.
    // E.g. for row-wise clues, omit left and right borders to highlight horizontal direction.

    if (j < this.leftMargin) {
      if (j !== this.leftMargin - 1)
        names.push("no-border-right")
      if (j !== 0)
        names.push("no-border-left")
    }

    if (i < this.topMargin) {
      if (i !== this.topMargin - 1)
        names.push("no-border-bottom")
      if (i !== 0)
        names.push("no-border-top")
    }

    // Add bold borders at a period of `subgridSize`, shifted according to the margins.

    if (i - this.topMargin === 0 || i === 0) {
      names.push("bold-border-top")
    } else if ((i - this.topMargin) % this.subgridSize === this.subgridSize - 1) {
      names.push("bold-border-bottom")
    }

    if (j - this.leftMargin === 0 || j === 0) {
      names.push("bold-border-left")
    } else if ((j - this.leftMargin) % this.subgridSize === this.subgridSize - 1) {
      names.push("bold-border-right")
    }

    return names
  }

  /**
   * Render a square of the full grid.
   * @param {number} gridY y-coordinate, row index
   * @param {number} gridX x-coordinate, col index
   */
  renderSquare(gridY, gridX) {
    const imageY = gridY - this.topMargin;
    const imageX = gridX - this.leftMargin;
    const value = (inRange(imageY, this.imageHeight) && inRange(imageX, this.imageWidth)) ?
          this.state.squares[imageY][imageX] :
          this.computeClue(gridY, gridX);
    const isError = this.state.errors.containsArray([imageY, imageX])
    return (
      <Square
        value={value}
        classNames={this.borderClassNames(gridY, gridX)
                        .concat(value == FILL ? ["fill"] : [])
                        .concat(isError ? ["error"] : [])
                        .join(' ')}
        onClick={() => this.handleLeftClick(gridY - this.topMargin, gridX - this.leftMargin)}
        onContextMenu={(event) => {
          event.preventDefault()
          this.handleRightClick(gridY - this.topMargin, gridX - this.leftMargin)
        }}
      />
    );
  }

  /**
   * Compute clue at grid coordinates (i, j). If there is none, return an empty string.
   *
   * @return {string | number} clue (a single number) at coordinates (i, j), or an empty string
   */
  computeClue(i, j) {
    // If both coordinates are inside the picture range or both outside, no clue can be displayed
    if ((i < this.topMargin) === (j < this.leftMargin)) {
      return ""
    }

    if (i < this.topMargin) {
      // Clue at the top, describes a column
      const clueIndex = this.topMargin - 1 - i;
      const clues = this.colClues[j - this.leftMargin];
      if (clueIndex < clues.length) {
        return clues.at(-clueIndex-1);
      } else {
        return "";
      }
    }

    if (j < this.leftMargin) {
      // Clue on the left, describes a row
      const clueIndex = this.leftMargin - 1 - j;
      const clues = this.rowClues[i - this.topMargin];
      if (clueIndex < clues.length) {
        return clues[clueIndex];
      } else {
        return "";
      }
    }
  }

  render() {
    return (
      <div>
        <h2>{this.props.level.title}</h2>
        <h2 className="status">{this.getStatus()}</h2>
        {this.state.squares.map((row, i) => (
            <div className="grid-row">
              {row.map((_, j) => (
                this.renderSquare(i, j)
              ))}
            </div>
        ))}
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      level: levels[0]
    }
  }

  render() {
    return (
      <div className="game">
        <div className="game-grid">
        <h2>New Game:</h2>
          {levels.map((level, levelIndex) => (
            <button onClick={() => this.changeLevel(levelIndex)}>{level.title}</button>
          ))}
          <Grid
            level={this.state.level}
            key={this.state.level.title}
          />
        </div>
      </div>
    );
  }

  changeLevel(levelIndex) {
    this.setState({
      level: levels[levelIndex]
    })
  }
}

/**
 * Shallow equality method for arrays.
 */
Array.prototype.equalsArray = function(other) {
  return this.length == other.length && other.every((x, i) => this.at(i) == x);
}

/**
 * Check if one array contains a given (shallow) array.
 */
Array.prototype.containsArray = function(other) {
  return this.filter(x => x.equalsArray(other)).length != 0;
}

/**
 * Filter coordinate pairs in a 2-d array according to function `f`.
 */
function filter2d(array, f) {
  return array.map((_, i) => i)
              .flatMap(i => array[i].map((_, j) => j)
                                    .filter(j => f(array[i][j], i, j))
                                    .map(j => [i, j]))
}

/**
 * Compute clue numbers on the basis of continuous chunks, by row.
 * @param level 2d array
 */
function computeRowClues(level) {
  return level.map(computeClues)
}

/**
 * Compute clue numbers on the basis of continuous chunks, by column.
 * @param level 2d array
 */
function computeColClues(level) {
  return computeRowClues(transpose(level))
}

/**
 * Transpose a 2-d array.
 */
function transpose(array) {
  return array[0].map((_, j) => array.map(row => row[j]));
}

/**
 * Check if x is in range from 0 (incl) to n (excl).
 *
 * @return {boolean}
 */
function inRange(x, n) {
  return 0 <= x && x < n;
}

/**
 * Compute clues for a sequence by identifying chunks of consequtive black squares.
 *
 * FIXME: Make the function more generic by accepting a function as parameter?
 */
function computeClues(seq) {
  const chunkSizes = []
  for (let i = 0; i < seq.length; i++) {
    let chunkSize = 0;
    for (; seq[i] === BLACK; i++) {
      chunkSize++
    }
    if (chunkSize !== 0) {
      chunkSizes.push(chunkSize)
    }
  }
  return chunkSizes
}

/**
 * Deep-copy a 2-d array.
 */
function copy2d(array) {
  return array.map(row => row.map(x => x));
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Game />);

