import React, { Component, Fragment } from 'react'
import ReactDOM from 'react-dom'
import { connect } from 'react-redux'
import { ipcRenderer, remote } from 'electron'
import { addTimer } from '../../modules/timer'
import styled from 'styled-components'
import { Scrollbars } from 'react-custom-scrollbars'
import api from '../../lib/api'
import Input from '../../components/input'
import Task from '../../components/task'
import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import faTimes from '@fortawesome/fontawesome-free-solid/faTimes'

class SearchContainer extends Component {
  constructor (props) {
    super(props)

    this.state = {
      searching: false,
      noResults: false,
      error: false,
      query: '',
      results: [],
      cursor: -1
    }

    this.listRefs = {}
    this.searchInput = React.createRef()

    this.onChange = this.onChange.bind(this)
    this.onKeyDown = this.onKeyDown.bind(this)
    this.triggerChange = this.triggerChange.bind(this)
    this.onAddTimer = this.onAddTimer.bind(this)
    this.onClearSearch = this.onClearSearch.bind(this)

    // When the user opens the window lets focus the search input
    // DISABLED 2019-01-03 DUE TO BUGGY BEHAVIOUR / TOO MANY EDGE CASES
    // ipcRenderer.on('windowVisible', () => {
    //   console.log('windowVisible')
    //   if (this.searchInput.current && !this.props.commenting)
    //     this.searchInput.current.focus()
    // })
  }

  componentWillMount () {
    this.searchTimer = null
  }

  onAddTimer (id, key, summary) {
    this.props.addTimer(id, key, summary)
    this.onClearSearch()
  }

  onClearSearch () {
    this.setState({
      query: '',
      results: []
    })
  }

  onChange (e) {
    clearTimeout(this.searchTimer)

    let query = e.target.value
    this.setState({ query })

    if (query != "")
      this.setState({ searching: true })

    this.searchTimer = setTimeout(this.triggerChange, 600)
  }

  onKeyDown (e) {
    switch (e.keyCode) {
      // Enter
      case 13:
        if (this.state.cursor === -1) {
          clearTimeout(this.searchTimer)
          this.triggerChange()
        } else {
          // Pressing enter while navigating tasks with keyboard
          let chosenTask = this.state.results[this.state.cursor]
          this.onAddTimer(chosenTask.id, chosenTask.key, chosenTask.fields.summary)
        }
        break

      // Up arrow
      case 38:
        e.preventDefault()

        if (this.state.cursor > -1)
          this.setState(prevState => ({
            cursor: prevState.cursor - 1
          }))

        this.scrollActiveTaskIntoView()
        break

      // Down arrow
      case 40:
        e.preventDefault()

        if (this.state.cursor < this.state.results.length - 1)
          this.setState(prevState => ({
            cursor: prevState.cursor + 1
          }))

        this.scrollActiveTaskIntoView()
        break
    }
  }

  scrollActiveTaskIntoView () {
    let itemComponent = this.refs.activeItem
    //console.log('itemComponent', itemComponent)
    if (itemComponent) {
      let domNode = ReactDOM.findDOMNode(itemComponent)
      domNode.scrollIntoView(true)
    }
  }

  triggerChange () {
    this.search(this.state.query)
    this.setState({ cursor: -1 })
  }

  search (query) {
    console.log('Searching', query)

    if (query == "") {
      return this.setState({
        searching: false,
        error: false,
        results: []
      })
    }

    this.setState({
      searching: true,
      error: false
    })

    const keySearch = query.indexOf("-") > -1
    const jqlSearch = query.indexOf('=') > -1 || query.indexOf('~') > 1
    let jql

    // Is the user searching with custom JQL syntax?
    // If not build the JQL for them
    if (jqlSearch) {
      jql = query
    } else {
      jql = `summary ~ "${query}"`
      if (keySearch) jql += `OR key = "${query}"`
      jql += 'order by updated DESC'
    }

    api.post('/search', {
      jql,
      maxResults: 20,
      fields: ['key', 'summary', 'project']
    })
      .then(results => {
        console.log('Search results', results)

        this.setState({
          searching: false,
          results: results.issues
        })
      })
      .catch(error => {
        console.log('Error fetching search results')

        this.setState({
          searching: false,
          error: true
        })
      })
  }

  render () {
    return (
      <Fragment>
        <SearchWrapper>
          <Input
            type="text"
            placeholder="Search for tasks"
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
            value={this.state.query}
            autoFocus
            ref={this.searchInput}
          />
          {(this.state.searching && !this.state.noResults) && (
            <SearchLoading>Searching...</SearchLoading>
          )}

          {this.state.error ? (
            <SearchLoading>Error fetching results</SearchLoading>
          ) : (
            <Fragment>
              {(this.state.query && !this.state.searching && !this.state.results.length) && (
                <SearchLoading>No results</SearchLoading>
              )}

              {(this.state.query && !this.state.searching && this.state.results.length !== 0) && (
                <SearchLoading onClick={this.onClearSearch}>
                  <FontAwesomeIcon icon={faTimes} />
                </SearchLoading>
              )}
            </Fragment>
          )}
        </SearchWrapper>

        {this.state.results.length ? (
          <Scrollbars
            autoHeight={true}
            autoHeightMax={331}
          >
            {this.state.results.map((task, i) => (
              <Task
                key={task.id}
                ref={i === this.state.cursor ? 'activeItem' : null}
                taskKey={task.key}
                highlighted={i === this.state.cursor}
                title={task.fields.summary}
                onAddTimer={() => this.onAddTimer(task.id, task.key, task.fields.summary)}
              />
            ))}
          </Scrollbars>
        ) : (null)}
      </Fragment>
    );
  }
}

const SearchWrapper = styled.div`
  padding: 10px;
  background: ${props => props.theme.darkMode ? props.theme.dark.wrapperBackground : '#f5f5f4' };
  position: relative;
`

const SearchLoading = styled.div`
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: #AAA;

  &:hover {
    cursor: pointer;
  }
`

const mapDispatchToProps = {
  addTimer
}

const mapStateToProps = state => ({
  timers: state.timer.list,
  commenting: state.timer.commenting
})

export default connect(mapStateToProps, mapDispatchToProps)(SearchContainer)
