import express from 'express'
import { Liquid } from 'liquidjs'

const app = express()
const engine = new Liquid()
const PORT = process.env.PORT || 8000

// --- Maps and Config ---
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

// Fetch squads once at startup
const SQUAD_PARAMS = new URLSearchParams({ 'filter[cohort]': '2526', 'filter[tribe][name]': 'FDND Jaar 1' })
const squadResponse = await fetch('https://fdnd.directus.app/items/squad?' + SQUAD_PARAMS)
const squadResponseJSON = await squadResponse.json()
const squadsData = squadResponseJSON.data

// --- Middleware ---
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true })) // Essential for reading POST data
app.engine('liquid', engine.express())
app.set('views', './views')

function getSortField(querySort) {
  return SORT_MAP[querySort] || 'name'
}

// --- ROUTES ---

// homepagina
app.get('/', async (request, response) => {
  const params = new URLSearchParams({
    'sort': getSortField(request.query.sort),
    'fields': '*,squads.*',
    'filter[squads][squad_id][tribe][name]': 'FDND Jaar 1',
    'filter[squads][squad_id][cohort]': '2526'
  })
  const personResponse = await fetch('https://fdnd.directus.app/items/person/?' + params)
  const personData = await personResponse.json()

  response.render('index.liquid', { persons: personData.data, squads: squadsData })
})

// convert de zoekmethode naar de /search voor betere url structuur

app.post('/search', (request, response) => {
  const searchTerm = request.body.search
  if (searchTerm) {
    response.redirect(303, `/search/${encodeURIComponent(searchTerm)}`)
  } else {
    response.redirect(303, '/')
  }
})

// vangt het formulier op
app.get('/search/:searchTerm', async (request, response) => {
  const searchTerm = request.params.searchTerm

  const params = new URLSearchParams({
    'fields': '*,squads.*',
    'filter[squads][squad_id][cohort]': '2526'
  })

if (searchTerm) {
    // Basic Info
    params.append('filter[_or][0][name][_icontains]', searchTerm)
    params.append('filter[_or][1][nickname][_icontains]', searchTerm)
    params.append('filter[_or][2][github_handle][_icontains]', searchTerm)
    
    // Location & Preferences
    params.append('filter[_or][3][residency][_icontains]', searchTerm)
    params.append('filter[_or][4][fav_season][_icontains]', searchTerm)
    params.append('filter[_or][5][fav_animal][_icontains]', searchTerm)
    
    // Tech & Vibe
    params.append('filter[_or][6][fav_property][_icontains]', searchTerm) // Matches "flex"
    params.append('filter[_or][7][fav_feature][_icontains]', searchTerm)  // Matches "DOM"
    params.append('filter[_or][8][vibe_emoji][_icontains]', searchTerm)   // Matches "🤑"
    
    // The "Hidden" Data (JSON string field)
    params.append('filter[_or][9][custom][_icontains]', searchTerm)     // Matches "Geld" or "figma"
  }

  const apiResponse = await fetch('https://fdnd.directus.app/items/person?' + params)
  const personData = await apiResponse.json()

  response.render('search.liquid', {
    persons: personData.data || [],
    searchTerm: searchTerm,
    squads: squadsData
  })
})

app.get('/student/:id', async (request, response) => {
  const personDetailResponse = await fetch('https://fdnd.directus.app/items/person/' + request.params.id)
  const personDetailResponseJSON = await personDetailResponse.json()
  response.render('student.liquid', { person: personDetailResponseJSON.data, squads: squadsData })
})

// Student or teacher 
app.get('/:roleSlug', async (request, response, next) => {
  const roleId = ROLE_MAP[request.params.roleSlug]
  if (!roleId) return next() 

  const params = new URLSearchParams({
    'filter[role][role_id]': roleId,
    'filter[squads][squad_id][cohort]': '2526',
    'fields': '*,role.role_id.name,mugshot,squads.*',
    'sort': getSortField(request.query.sort),
    'limit': -1
  })

  const apiResponse = await fetch('https://fdnd.directus.app/items/person?' + params)
  const personData = await apiResponse.json()
  const persons = personData.data || []
  const roleName = persons[0]?.role[0]?.role_id?.name || request.params.roleSlug

  response.render('all.liquid', { persons: persons, roleName: roleName, squads: squadsData })
})

app.listen(PORT, () => console.log(`App: http://localhost:${PORT}`))