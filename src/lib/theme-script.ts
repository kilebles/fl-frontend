export const THEME_KEY = "theme"

/** Runs before hydration so the page never flashes the wrong theme. */
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="claude"){document.documentElement.dataset.theme="claude";document.documentElement.classList.remove("dark")}}catch(e){}`
