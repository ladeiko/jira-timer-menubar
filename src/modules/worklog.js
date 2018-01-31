import { ipcRenderer } from 'electron'
import Immutable from 'seamless-immutable'
import find from 'lodash.find'
import parse from 'date-fns/parse'
import isToday from 'date-fns/is_today'
import isThisWeek from 'date-fns/is_this_week'
import isYesterday from 'date-fns/is_yesterday'

// Actions
const ADD_WORKLOG = 'jt/worklog/ADD_WORKLOG'
const SET_UPDATING = 'jt/worklog/SET_UPDATING'

const initialState = Immutable({
  list: [],
  totals: {
    day: 0,
    yesterday: 0,
    week: 0
  },
  updating: false
})

// Reducer
export default function reducer (state = initialState, action = {}) {
  switch (action.type) {

    case ADD_WORKLOG: {

      let dayTotal = 0
      let yesterdayTotal = 0
      let weekTotal = 0

      action.worklogs.forEach(worklog => {
        let created = parse(worklog.created)

        if (isToday(created))
          dayTotal += worklog.timeSpentSeconds

        if (isYesterday(created))
          yesterdayTotal += worklog.timeSpentSeconds

        // Week starts on Monday (1)
        if (isThisWeek(created, 1))
          weekTotal += worklog.timeSpentSeconds
      })

      let nextState = state.set('list', Immutable(action.worklogs))
      nextState = nextState.setIn(['totals', 'day'], dayTotal)
      nextState = nextState.setIn(['totals', 'yesterday'], yesterdayTotal)
      nextState = nextState.setIn(['totals', 'week'], weekTotal)

      return nextState
    }

    case SET_UPDATING:
      return state.set('updating', action.updating)

    default: return state
  }
}

// Action Creators
export const setUpdating = updating => ({
  type: SET_UPDATING,
  updating
})

// Pass array of worklogs
export const addWorklogs = worklogs => ({
  type: ADD_WORKLOG,
  worklogs
})

// Full week isn't supported yet (need to work on merging states)
export const fetchWorklogs = (fullWeek = true) => (dispatch, getState) => {

  let state = getState()
  let updating = state.worklog.updating

  if (updating) {
    console.log('Update of worklogs already in progress')
    return
  }

  if (typeof state.user.profile.key === "undefined") {
    console.log('Cant fetch worklogs until we have a user')
    return
  }

  console.log('Requesting worklogs')

  dispatch(setUpdating(true))

  ipcRenderer.send('fetchWorklogs', {
    fullWeek,
    userKey: state.user.profile.key
  })
}

