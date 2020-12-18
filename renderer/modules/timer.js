import Immutable from 'seamless-immutable'
import find from 'lodash.find'
import findIndex from 'lodash.findindex'
import api from '../lib/api'
import { addRecentTask } from './recent'
import { fetchWorklogs } from './worklog'
import { roundToNearestMinutes, secondsHuman } from '../lib/time'
import format from 'date-fns/format'

// Actions
const ADD_TIMER = 'jt/timer/ADD_TIMER'
const DELETE_TIMER = 'jt/timer/DELETE_TIMER'
const PAUSE_TIMER = 'jt/timer/PAUSE_TIMER'
const PAUSE_ALL_TIMERS = 'jt/timer/PAUSE_ALL_TIMERS'
const POST_TIMER = 'jt/timer/POST_TIMER'
const UPDATE_TIMER = 'jt/timer/UPDATE_TIMER'
const UPDATE_COMMENT = 'jt/timer/UPDATE_COMMENT'
const SET_COMMENTING = 'jt/timer/SET_COMMENTING'

const initialState = Immutable({
  list: [],
  commenting: false
})

const MAX_TIMERS = 10;

// Reducer
export default function reducer (state = initialState, action = {}) {
  switch (action.type) {

    case ADD_TIMER: {
      // We don't want to allow duplicate timers
      let existingTimer = find(state.list, ['id', action.timer.id])

      if (state.list.length < MAX_TIMERS && !existingTimer) {

        let list = Immutable.asMutable(state.list, { deep: true })

        if (!action.timer.paused) {

          list.forEach((timer) => {

            // We need to make sure the timer isn't already paused. Otherwise we will
            // be adding time since it was last paused!
            if (!timer.paused) {
              timer.paused = true;
              timer.endTime = Date.now()
              timer.previouslyElapsed = (Date.now() - timer.startTime) + timer.previouslyElapsed
            }

          });
        }

        return state.set('list', Immutable([action.timer].concat(list)))
      }
    }

    case DELETE_TIMER: {
      let timerIndex = findIndex(state.list, ['id', action.timerId])

      if (timerIndex > -1) {
        let list = state.list.asMutable()
        list.splice(timerIndex, 1)
        return state.set('list', Immutable(list))
      }
    }

    case PAUSE_ALL_TIMERS: {
      let list = Immutable.asMutable(state.list, {deep: true})
      list.forEach((timer) => {
        // We need to make sure the timer isn't already paused. Otherwise we will
        // be adding time since it was last paused!
        if (!timer.paused) {
          timer.paused = true;
          timer.endTime = Date.now()
          timer.previouslyElapsed = (Date.now() - timer.startTime) + timer.previouslyElapsed
        }
      })
      return state.set('list', Immutable(list))
    }

    case PAUSE_TIMER: {
      let list = Immutable.asMutable(state.list, {deep: true})
      let timerIndex = findIndex(list, ['id', action.timerId])

      if (timerIndex > -1) {
        let timer = list[timerIndex]

        if (action.pause) {
          // We need to make sure the timer isn't already paused. Otherwise we will
          // be adding time since it was last paused!
          if (!timer.paused) {
            timer.endTime = Date.now()
            timer.previouslyElapsed = (Date.now() - timer.startTime) + timer.previouslyElapsed
          }
        } else {
          timer.startTime = Date.now()
        }

        timer.paused = action.pause

        // Pause others
        if (!action.pause) {
          list.forEach((timer) => {

            if (timer.id === action.timerId) {
              return;
            }

            // We need to make sure the timer isn't already paused. Otherwise we will
            // be adding time since it was last paused!
            if (!timer.paused) {
              timer.paused = true;
              timer.endTime = Date.now()
              timer.previouslyElapsed = (Date.now() - timer.startTime) + timer.previouslyElapsed
            }

          });
        }

        return state.set('list', Immutable(list))
      } else {
        return state
      }
    }

    case POST_TIMER: {
      let list = Immutable.asMutable(state.list, {deep: true})
      let timerIndex = findIndex(list, ['id', action.timerId])

      if (timerIndex > -1) {
        let timer = list[timerIndex]
        timer.posting = action.posting

        return state.set('list', Immutable(list))
      } else {
        return state
      }
    }

    case UPDATE_TIMER: {
      let list = Immutable.asMutable(state.list, {deep: true})
      let timerIndex = findIndex(list, ['id', action.timerId])

      if (timerIndex > -1) {
        let timer = list[timerIndex]
        timer.previouslyElapsed = action.ms

        return state.set('list', Immutable(list))
      } else {
        return state
      }
    }

    case UPDATE_COMMENT: {
      let list = Immutable.asMutable(state.list, {deep: true})
      let timerIndex = findIndex(list, ['id', action.timerId])

      if (timerIndex > -1) {
        let timer = list[timerIndex]
        timer.comment = action.comment

        return state.set('list', Immutable(list))
      } else {
        return state
      }
    }

    case SET_COMMENTING: {
      return state.set('commenting', action.commenting)
    }

    default: return state
  }
}

// Action Creators
export const deleteTimer = timerId => ({
  type: DELETE_TIMER,
  timerId
})

export const pauseTimer = (timerId, pause) => ({
  type: PAUSE_TIMER,
  timerId,
  pause
})

export const pauseAllTimers = () => ({
  type: PAUSE_ALL_TIMERS
})

export const postingTimer = (timerId, posting) => ({
  type: POST_TIMER,
  timerId,
  posting
})

export const updateTimer = (timerId, ms) => ({
  type: UPDATE_TIMER,
  timerId,
  ms
})

export const updateComment = (timerId, comment) => ({
  type: UPDATE_COMMENT,
  timerId,
  comment
})

export const setCommenting = commenting => ({
  type: SET_COMMENTING,
  commenting
})

// Side effects
export const addTimer = (id, key, summary) => async dispatch => {
  let timer = {
    id,
    key,
    summary,
    paused: false,
    startTime: Date.now(),
    endTime: null,
    previouslyElapsed: 0,
    comment: ''
  }

  dispatch({ type: ADD_TIMER, timer })
}

export const postTimer = stateTimer => async (dispatch, getState) => {

  // Pause timer and save current elapsed time against timer
  dispatch(pauseTimer(stateTimer.id, true))
  dispatch(postingTimer(stateTimer.id, true))

  // We need the state after the above dispatches
  process.nextTick(() => {

    let timers = getState().timer.list

    let timer = find(timers, ['id', stateTimer.id])

    if (!timer)
      return

    let seconds = Math.round(timer.previouslyElapsed / 1000)
    let nearestMinutes = roundToNearestMinutes(seconds)
    let humanTime = secondsHuman(nearestMinutes * 60)

    console.log('previouslyElapsed', timer.previouslyElapsed)
    console.log('Posting', nearestMinutes)

    api.post(`/issue/${timer.key}/worklog`, {
      timeSpent: `${nearestMinutes}m`,
      started: format(new Date(), 'YYYY-MM-DDTHH:mm:ss.SSSZZ'),
      comment: timer.comment
    })
      .then(worklog => {
        console.log('Saved worklog', worklog)
        dispatch(deleteTimer(timer.id))

        new Notification(`${humanTime} posted`, {
          body: `Your time for ${timer.key} has been posted to JIRA`,
          silent: true
        })

        // Save to recents
        dispatch(addRecentTask(timer))
        dispatch(fetchWorklogs())
      })
      .catch(error => {
        console.log('Error posting timer', error)
        dispatch(postingTimer(timer.id, false))

        new Notification('Error posting timer', {
          body: `Timer ${timer.key} failed to send, please try again`
        })
      })
    })
}
