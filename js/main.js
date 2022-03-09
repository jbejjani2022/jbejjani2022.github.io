document.addEventListener("DOMContentLoaded", () => {

  // also in local storage
  let currentWordIndex = 0;
  let guessedWordCount = 0;
  let availableSpace = 1;
  let guessedWords = [[]];

  let gameOver = false;
  let typingDisabled = false;

  const words = ['teamo', 'goofy', 'erupt', 'rodya', 'yemms', 'wilde', 'lodge',
  'oingo', 'koala', 'spicy', 'mynah', 'lemon', 'stews', 'zebra', 'gecko', 'dandy', 'lions',
  'black', 'widow', 'thing', 'penne', 'treks', 'water', 'hippo', 'bathe', 'cygne',
  'sudsy', 'bones', 'hammy', 'ikeas', 'smirk', 'chefs', 'croak', 'rhino', 'banan', 'grego',
  'moist', 'peach', 'smack', 'baker', 'thigh', 'yoked', 'shark', 'goose', 'cream',
  'mamme', 'erics', 'horny', 'shave', 'ocean', 'frogs', 'tasty', 'crack', 'titty', 'mamag',
  'quack', 'beard', 'cutie', 'beaky', 'dicks', 'vodka', 'fruit', 'salad', 'pipes',
  'gnome', 'tales', 'shrek', 'froth', 'honey', 'chair', 'booby', 'crave', 'stump',
  'train', 'lemot', 'monks', 'brain', 'freud', 'plane', 'beefy', 'dhruv', 'bisou',
  'views', 'thick', 'bosom', 'kiwis', 'throb', 'witty', 'belle', 'beans', 'choke',
  'mummy', 'quake', 'south', 'naked', 'tight', 'feast', 'peaky', 'juicy', 'crepe',
  'lorax', 'chimp', 'quads', 'ponds', 'stats', 'books', 'glove', 'frome', 'angel',
  'smile', 'cooks', 'blind', 'shred', 'apple', 'bball', 'spank', 'lists', 'sleep',
  'mouth', 'durak', 'besar', 'alexb', 'lubed', 'masks', 'larry', 'crisp', 'queen',
  'speed', 'ucute', 'snowy', 'toads', 'umami', 'spoon', 'tanks', 'meaty', 'thong',
  'dream', 'movie', 'boxer', 'pants', 'hotty', 'baths', 'heart', 'jazzy', 'sucks',
  'berry', 'curly', 'beach', 'caddy', 'froze', 'sweet', 'cheek', 'fuzzy', 'birds',
  'teach', 'balls', 'latte', 'pasta', 'goats', 'hairy', 'rohan', 'geese', 'flick',
  'dinos', 'booty', 'tippy', 'beast', 'tacos', 'dates', 'boobs', 'mrsir',
  'bajet', 'dante', 'snack', 'sushi', 'egret', 'burds', 'trips', 'pizza', 'apish',
  'cados', 'quaad', 'socks', 'track', 'vlogs', 'snail', 'grape', 'notes', 'razor',
  'babka', 'llama', 'dapup', 'poems', 'walks', 'yemen', 'bikes', 'throw', 'shake',
  'licks', 'soaks', 'nerds'];

  let currentWord = words[currentWordIndex];

  initLocalStorage();
  initHelpModal();
  initStatsModal();
  createSquares();
  addKeyboardClicks();
  addBirdClick();
  addKeyboardTyping();
  loadLocalStorage();
  // getNewWord();


  function initLocalStorage() {
    const storedCurrentWordIndex = window.localStorage.getItem('currentWordIndex');
    if (!storedCurrentWordIndex) {
      window.localStorage.setItem('currentWordIndex', currentWordIndex);
    } else {
      // local storage only stores strings, so have to convert back to number
      currentWordIndex = Number(storedCurrentWordIndex);
      currentWord = words[currentWordIndex];
    }
  }

  function loadLocalStorage() {
    currentWordIndex = Number(window.localStorage.getItem('currentWordIndex')) || currentWordIndex;
    guessedWordCount = Number(window.localStorage.getItem('guessedWordCount')) || guessedWordCount;
    availableSpace = Number(window.localStorage.getItem('availableSpace')) || availableSpace;
    guessedWords = JSON.parse(window.localStorage.getItem('guessedWords')) || guessedWords;

    currentWord = words[currentWordIndex];

    const storedBoardContainer = window.localStorage.getItem('boardContainer');
    if (storedBoardContainer) {
      document.getElementById('board-container').innerHTML = storedBoardContainer;
    }

    const storedKeyboardContainer = window.localStorage.getItem('keyboardContainer');
    if (storedKeyboardContainer) {
      document.getElementById('keyboard-container').innerHTML = storedKeyboardContainer;
      addKeyboardClicks();
    }
  }

  function resetGameState() {
    window.localStorage.removeItem("guessedWordCount");
    window.localStorage.removeItem("guessedWords");
    window.localStorage.removeItem("keyboardContainer");
    window.localStorage.removeItem("boardContainer");
    window.localStorage.removeItem("availableSpace");
  }

  // const animateCSS = (node, animation, prefix = 'animate__') =>
//
  //   // We create a Promise and return it
  //   new Promise((resolve, reject) => {
  //   const animationName = `${prefix}${animation}`;
//
  //   node.classList.add(`${prefix}animated`, animationName);
//
  //   // When the animation ends, we clean the classes and resolve the Promise
  //   function handleAnimationEnd(event) {
  //       event.stopPropagation();
  //       node.classList.remove(`${prefix}animated`, animationName);
  //       resolve('Animation ended');
  //   }
//
  //   node.addEventListener('animationend', handleAnimationEnd, {once: true});
  //   });

  // gets random word from wordsapi
  // function getNewWord() {
  //   fetch(
  //     `https://wordsapiv1.p.rapidapi.com/words/?random=true&letters=5&frequencymin=7`,
  //     {
  //       method: "GET",
  //       headers: {
  //         "x-rapidapi-host": "wordsapiv1.p.rapidapi.com",
  //         "x-rapidapi-key": "f67c21006bmshc510e9bc5e7aca9p14c25djsn0ad143dca1b8",
  //       },
  //     }
  //   )
  //     .then((response) => {
  //       return response.json();
  //     })
  //     .then((res) => {
  //       currentWord = res.word;
  //     })
  //     .catch((err) => {
  //       console.error(err);
  //     });
  // }

  function createSquares() {
    const gameBoard = document.getElementById("board");

    for (let i = 0; i < 30; i++) {
      let square = document.createElement("div");
      square.classList.add("animate__animated");
      square.classList.add("square");
      square.setAttribute("id", i + 1);
      gameBoard.appendChild(square);
    }
  }

  function preserveGameState() {
    window.localStorage.setItem('guessedWords', JSON.stringify(guessedWords));

    const keyboardContainer = document.getElementById('keyboard-container');
    window.localStorage.setItem('keyboardContainer', keyboardContainer.innerHTML);

    const boardContainer = document.getElementById('board-container');
    window.localStorage.setItem('boardContainer', boardContainer.innerHTML);
  }

  function getCurrentWordArr() {
    const numberOfGuessedWords = guessedWords.length;
    return guessedWords[numberOfGuessedWords - 1];
  }

  function updateGuessedLetters(letter) {
    const currentWordArr = getCurrentWordArr();

    if (currentWordArr && currentWordArr.length < 5) {
      currentWordArr.push(letter);

      const availableSpaceEl = document.getElementById(availableSpace);

      availableSpaceEl.textContent = letter;
      availableSpace = availableSpace + 1;
    }
  }

  // function showResult() {
  //   const finalResultEl = document.getElementById("final-score");
  //   finalResultEl.textContent = "Wordle 1 - You win!";
  // }

  // function showLosingResult() {
  //   const finalResultEl = document.getElementById("final-score");
  //   finalResultEl.textContent = `Wordle 1 - Unsuccessful Today!`;
  // }

  // function clearBoard() {
  //   for (let i = 0; i < 30; i++) {
  //     let square = document.getElementById(i + 1);
  //     square.textContent = "";
  //   }
//
  //   const keys = document.getElementsByClassName("keyboard-button");
//
  //   for (var key of keys) {
  //     key.disabled = true;
  //   }
  // }

  function getIndicesOfLetter(letter, arr) {
    const indices = [];
    let idx = arr.indexOf(letter);
    while (idx != -1) {
      indices.push(idx);
      idx = arr.indexOf(letter, idx + 1);
    }
    return indices;
  }

  function getTileClass(letter, index, currentWordArr) {
    const isCorrectLetter = currentWord
      .toUpperCase()
      .includes(letter.toUpperCase());

    if (!isCorrectLetter) {
      return "incorrect-letter";
    }

    const letterInThatPosition = currentWord.charAt(index);
    const isCorrectPosition =
      letter.toLowerCase() === letterInThatPosition.toLowerCase();

    if (isCorrectPosition) {
      return "correct-letter-in-place";
    }

    const isGuessedMoreThanOnce =
      currentWordArr.filter((l) => l === letter).length > 1;

    if (!isGuessedMoreThanOnce) {
      return "correct-letter";
    }

    const existsMoreThanOnce =
      currentWord.split("").filter((l) => l === letter).length > 1;

    // is guessed more than once and exists more than once
    if (existsMoreThanOnce) {
      return "correct-letter";
    }

    const hasBeenGuessedAlready = currentWordArr.indexOf(letter) < index;

    const indices = getIndicesOfLetter(letter, currentWord.split(""));
    const otherIndices = indices.filter((i) => i !== index);
    const isGuessedCorrectlyLater = otherIndices.some(
      (i) => i > index && currentWordArr[i] === letter
    );

    if (!hasBeenGuessedAlready && !isGuessedCorrectlyLater) {
      return "correct-letter";
    }

    return "incorrect-letter";
  }

  function updateWordIndex() {
    // if at the end of word list, wrap around to beginning
    if (currentWordIndex === (words.length - 1)) {
      window.localStorage.setItem('currentWordIndex', 0);
    }
    else {
      window.localStorage.setItem('currentWordIndex', currentWordIndex + 1);
    }
  }

  function updateTotalGames() {
    const totalGames = window.localStorage.getItem('totalGames') || 0;
    window.localStorage.setItem('totalGames', Number(totalGames) + 1);
  }

  function updateStatsPostWin() {
    const totalWins = window.localStorage.getItem('totalWins') || 0;
    window.localStorage.setItem('totalWins', Number(totalWins) + 1);

    const currentStreak = window.localStorage.getItem('currentStreak') || 0;
    window.localStorage.setItem('currentStreak', Number(currentStreak) + 1);
  }

  function updateStatsPostLoss() {
    window.localStorage.setItem('currentStreak', 0);
  }

  async function handleSubmitWord() {
    const currentWordArr = getCurrentWordArr();
    const guessedWord = currentWordArr.join("");

    if (guessedWord.length !== 5) {
      // const firstLetterId = guessedWordCount * 5 + 1;
      // currentWordArr.forEach((letter, index) => {
//
      //   const letterId = firstLetterId + index;
      //   const letterEl = document.getElementById(letterId);
//
      //   animateCSS(letterEl, "headShake");
      // });

      var popUp = document.getElementById('alert');
      popUp.textContent = "Gotta be 5 letters nerd.";
      $('#alert').show();
      const interval = 700;
      setTimeout(() => {
        $('#alert').fadeOut('slow');
      }, interval);

      return;
    }

    try {
       const res = await fetch(
         `https://wordsapiv1.p.rapidapi.com/words/${guessedWord.toLowerCase()}`,
         {
           method: "GET",
           headers: {
             "x-rapidapi-host": "wordsapiv1.p.rapidapi.com",
             "x-rapidapi-key": "f67c21006bmshc510e9bc5e7aca9p14c25djsn0ad143dca1b8",
           },
         }
       );

       if (!res.ok && !words.includes(guessedWord.toLowerCase())) {
         throw Error();
      }

      const firstLetterId = guessedWordCount * 5 + 1;

      window.localStorage.setItem("availableSpace", availableSpace);

      typingDisabled = true;

      const interval = 400;
      currentWordArr.forEach((letter, index) => {
        setTimeout(() => {
          const tileClass = getTileClass(letter, index, currentWordArr);
          if (tileClass) {
            const letterId = firstLetterId + index;
            const letterEl = document.getElementById(letterId);
            // animateCSS(letterEl, "flipInX");
            letterEl.classList.add("animate__flipInX");
            letterEl.classList.add(tileClass);

            const keyboardEl = document.querySelector(`[data-key=${letter}]`);
            keyboardEl.classList.add(tileClass);
          }

          if (index === 4) {
            preserveGameState();
            typingDisabled = false;
          }

        }, index * interval);
      });

      guessedWordCount += 1;
      window.localStorage.setItem('guessedWordCount', guessedWordCount);

      if (guessedWord === currentWord) {
        gameOver = true;
        const interval = 2000;
        setTimeout(() => {

          const firstLetterId = (guessedWordCount - 1) * 5 + 1;
          currentWordArr.forEach((letter, index) => {

            const letterId = firstLetterId + index;
            const letterEl = document.getElementById(letterId);

            // animateCSS(letterEl, "flip");
            letterEl.classList.add("animate__flip");
          });

        }, interval);


        var popUp = document.getElementById('alert');
        popUp.textContent = "Nice nerd! I give you that.";

        setTimeout(() => {
          $('#alert').show();
          updateWordIndex();
          updateTotalGames();
          updateStatsPostWin();
          resetGameState();
        }, 3000);

        setTimeout(() => {
          $('#alert').fadeOut('slow');
          // const okSelected = window.confirm("Nice nerd.");
          // if (okSelected) {
          //   clearBoard();
          //   showResult();
          // }
          return;
        }, 5000);
      }

      if (guessedWords.length === 6 && guessedWord !== currentWord) {
        gameOver = true;

        var popUp = document.getElementById('alert');
        popUp.textContent = `Ah...nerd...the word is ${currentWord.toUpperCase()}.`;

        setTimeout(() => {
          $('#alert').show();
          updateWordIndex();
          updateTotalGames();
          updateStatsPostLoss();
          resetGameState();
          return;
        }, 2000);
      }

      guessedWords.push([]);
    } catch (_error) {
        // const firstLetterId = guessedWordCount * 5 + 1;
        // currentWordArr.forEach((letter, index) => {
//
        //   const letterId = firstLetterId + index;
        //   const letterEl = document.getElementById(letterId);
//
        //   animateCSS(letterEl, "headShake");
        // });

        var popUp = document.getElementById('alert');
        popUp.textContent = "I don't think that's a word, nerd.";
        $('#alert').show();

        const interval = 700;
        setTimeout(() => {
          $('#alert').fadeOut('slow');
        }, interval);

    }
  }

  function handleDelete() {
    const currentWordArr = getCurrentWordArr();

    if (!currentWordArr.length) {
      return;
    }

    currentWordArr.pop();

    guessedWords[guessedWords.length - 1] = currentWordArr;

    const lastLetterEl = document.getElementById(availableSpace - 1);

    lastLetterEl.innerHTML = "";
    availableSpace = availableSpace - 1;
  }

  function addKeyboardClicks() {
    const keys = document.querySelectorAll(".keyboard-row button");
    for (let i = 0; i < keys.length; i++) {
      keys[i].addEventListener("click", ({ target }) => {
        const key = target.getAttribute("data-key");

        if (gameOver || typingDisabled) {
          return;
        }

        if (key === "enter") {
          handleSubmitWord();
          return;
        }

        if (key === "del") {
          handleDelete();
          return;
        }

        updateGuessedLetters(key);
      });
    }
  }

  function addBirdClick() {
    const bird = document.getElementById("bird");
    bird.addEventListener("click", () => {
      window.location.reload();
    });
  }

  function isLetter(str) {
        return str.length === 1 && str.match(/[a-z]/i);
    }

  function addKeyboardTyping() {
    // Add event listener on keydown
    document.addEventListener('keydown', (event) => {
        const name = event.key;
        const code = event.code;

        if (gameOver || typingDisabled) {
          return;
        }

        if (name === 'Enter') {
            handleSubmitWord();
            return;
        }

        if (name === 'Backspace') {
            handleDelete();
            return;
        }

        if (!isLetter(name)) {
            return;
        }

        updateGuessedLetters(name);

    }, false);
  }

  function initHelpModal() {
    const modal = document.getElementById("help-modal");

    // Get the button that opens the modal
    const btn = document.getElementById("help");

    // Get the <span> element that closes the modal
    const span = document.getElementById("close-help");

    // When the user clicks on the button, open the modal
    btn.addEventListener("click", function () {
      modal.style.display = "block";
    });

    // When the user clicks on <span> (x), close the modal
    span.addEventListener("click", function () {
      modal.style.display = "none";
    });

    // When the user clicks anywhere outside of the modal, close it
    window.addEventListener("click", function (event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    });
  }

  function updateStatsModal() {
    const currentStreak = window.localStorage.getItem("currentStreak");
    const totalWins = window.localStorage.getItem("totalWins");
    const totalGames = window.localStorage.getItem("totalGames");

    document.getElementById('current-streak').textContent = currentStreak;
    document.getElementById('total-played').textContent = totalGames;
    document.getElementById('total-wins').textContent = totalWins;

    const winPct = Math.round((totalWins / totalGames) * 100) || 0;
    document.getElementById('win-pct').textContent = winPct;
  }

  function initStatsModal() {
    const modal = document.getElementById("stats-modal");

    // Get the button that opens the modal
    const btn = document.getElementById("stats");

    // Get the <span> element that closes the modal
    const span = document.getElementById("close-stats");

    // When the user clicks on the button, open the modal
    btn.addEventListener("click", function () {
      // update stats here
      updateStatsModal();
      modal.style.display = "block";
    });

    // When the user clicks on <span> (x), close the modal
    span.addEventListener("click", function () {
      modal.style.display = "none";
    });

    // When the user clicks anywhere outside of the modal, close it
    window.addEventListener("click", function (event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    });
  }
});