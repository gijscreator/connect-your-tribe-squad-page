import express from 'express'
import { Liquid } from 'liquidjs'

const app = express()
const engine = new Liquid()
const PORT = process.env.PORT || 8000
const API_BASE = 'https://fdnd.directus.app/items'

// --- Config ---
const ROLE_MAP = {
  'teachers': 1, 'leaders': 2, 'tribes': 3, 'students': 4,
  'experts': 5, 'owners': 6, 'officers': 7
}

const SORT_MAP = {
  'baldness': 'is_bold', 'a-z': 'name', 'shoe-size': 'shoe_size',
  'season': 'fav_season', 'age': 'birthdate', 'fav-css': 'fav_property',
  'nickname': 'nickname', 'git-handle': 'github_handle',
  'fav-color': 'fav_color', 'residency': 'residency', 'z-a': '-name'
}

// --- Middleware & Engine ---
app.engine('liquid', engine.express())
app.set('views', './views')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// 1. Centralized Fetch Helper
async function fetchItems(endpoint, queryParams = {}) {
  const defaultParams = {
    'filter[squads][squad_id][cohort]': '2526',
    'fields': '*,squads.*'
  }
  const mergedParams = new URLSearchParams({ ...defaultParams, ...queryParams })
  
  try {
    const response = await fetch(`${API_BASE}/${endpoint}?${mergedParams}`)
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
    const json = await response.json()
    return json.data || []
  } catch (err) {
    console.error(err)
    return []
  }
}

// 2. Load Squads once and make them globally available to Liquid
const squadsData = await fetchItems('squad', { 'filter[tribe][name]': 'FDND Jaar 1' })
app.locals.squads = squadsData 

// Helper for sorting
const getSortField = (querySort) => SORT_MAP[querySort] || 'name'

// --- ROUTES ---

app.get('/', async (req, res) => {
  const persons = await fetchItems('person', {
    'sort': getSortField(req.query.sort),
    'filter[squads][squad_id][tribe][name]': 'FDND Jaar 1'
  })
  res.render('index.liquid', { persons })
})

app.post('/search', (req, res) => {
  const searchTerm = req.body.search?.trim()
  res.redirect(303, searchTerm ? `/search/${encodeURIComponent(searchTerm)}` : '/')
})

app.get('/search/:searchTerm', async (req, res) => {
  const { searchTerm } = req.params
  
  // --- The Easter Egg Logic ---
  const isEasterEgg = searchTerm.toLowerCase() === 'koop'
  
  const searchFields = [
    'name', 'nickname', 'github_handle', 'residency', 
    'fav_season', 'fav_animal', 'fav_property', 'vibe_emoji', 'custom'
  ]
  
  const query = {}
  searchFields.forEach((field, index) => {
    query[`filter[_or][${index}][${field}][_icontains]`] = searchTerm
  })

  const persons = await fetchItems('person', query)

  // Choose the template based on the search term
  const template = isEasterEgg ? 'koop.liquid' : 'search.liquid'
  
  res.render(template, { persons, searchTerm })
})

app.get('/student/:id', async (req, res) => {
  // Single items don't need the list filters, so we use fetch directly or a modified helper
  const person = await fetchItems(`person/${req.params.id}`)
  res.render('student.liquid', { person })
})

app.get('/:roleSlug', async (req, res, next) => {
  const roleId = ROLE_MAP[req.params.roleSlug]
  if (!roleId) return next()

  const persons = await fetchItems('person', {
    'filter[role][role_id]': roleId,
    'sort': getSortField(req.query.sort),
    'limit': -1
  })

  const roleName = persons[0]?.role?.[0]?.role_id?.name || req.params.roleSlug
  res.render('all.liquid', { persons, roleName })
})

app.listen(PORT, () => console.log(`App: http://localhost:${PORT}`))