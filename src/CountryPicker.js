/**
 * react-native-country-picker
 * @author Nahom<nahomt@amestsantim.com>
 * @flow
 */

// eslint-disable-next-line
import React, { Component } from 'react';

let PropTypes = null;

// eslint-disable-next-line
PropTypes = require('prop-types');

if (!PropTypes) {
  PropTypes = React.PropTypes;
}

// eslint-disable-next-line
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Modal,
  Text,
  TextInput,
  ListView,
  ScrollView,
  Platform,
} from 'react-native';

import Fuse from 'fuse.js';

import m49List from '../data/m49';
import { getHeightPercent } from './ratio';
import CloseButton from './CloseButton';
import countryPickerStyles from './CountryPicker.style';
import KeyboardAvoidingView from './KeyboardAvoidingView';

let countries = null;
let Emoji = null;
let styles = {};

// Maybe someday android get all flags emoji
// but for now just ios
// const isEmojiable = Platform.OS === 'ios' ||
// (Platform.OS === 'android' && Platform.Version >= 21);
const isEmojiable = Platform.OS === 'ios';

if (isEmojiable) {
  countries = require('../data/countries-emoji');
  Emoji = require('./emoji').default;
} else {
  countries = require('../data/countries');

  Emoji = <View />;
}

export const getAllCountries = () => m49List.map((m49) => ({ ...countries[m49], m49 }));

const ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });

export default class CountryPicker extends Component {
  static propTypes = {
    //m49: PropTypes.string.isRequired,
    translation: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func,
    closeable: PropTypes.bool,
    filterable: PropTypes.bool,
    children: PropTypes.node,
    countryList: PropTypes.array,
    excludeCountries: PropTypes.array,
    styles: PropTypes.object,
    filterPlaceholder: PropTypes.string,
    autoFocusFilter: PropTypes.bool,
  }

  static defaultProps = {
    translation: 'en',
    countryList: m49List,
    excludeCountries: [],
    filterPlaceholder: 'Filter',
    autoFocusFilter: true,
  }

  static renderEmojiFlag(m49, emojiStyle) {
    return (
      <Text style={[styles.emojiFlag, emojiStyle]}>
        { m49 !== '' && countries[m49.toUpperCase()] ? <Emoji name={countries[m49.toUpperCase()].flag} /> : null }
      </Text>
    );
  }

  static renderImageFlag(m49, imageStyle) {
    return m49 !== '' ? <Image
      style={[styles.imgStyle, imageStyle]}
      source={{ uri: countries[m49].flag }}
    /> : null;
  }

  static renderFlag(m49, itemStyle, emojiStyle, imageStyle) {
    return (
      <View style={[styles.itemCountryFlag, itemStyle]}>
        {isEmojiable ?
            CountryPicker.renderEmojiFlag(m49, emojiStyle)
            : CountryPicker.renderImageFlag(m49, imageStyle)}
      </View>
    );
  }

  constructor(props) {
    super(props);

    let countryList = [...props.countryList],
      excludeCountries = [...props.excludeCountries];

    excludeCountries.map((excludeCountry)=>{
      let index = countryList.indexOf(excludeCountry);

      if(index !== -1){
        countryList.splice(index, 1);
      }
    });

    // Sort country list
    countryList = countryList
      .map(c => [c, this.getCountryName(countries[c])])
      .sort((a, b) => {
        if (a[1] < b[1]) return -1;
        if (a[1] > b[1]) return 1;
        return 0;
      }).map(c => c[0]);

    this.state = {
      modalVisible: false,
      m49List: countryList,
      dataSource: ds.cloneWithRows(countryList),
      filter: '',
      letters: this.getLetters(countryList),
    };

    if (this.props.styles) {
      Object.keys(countryPickerStyles).forEach(key => {
        styles[key] = StyleSheet.flatten([
          countryPickerStyles[key],
          this.props.styles[key],
        ]);
      });
      styles = StyleSheet.create(styles);
    } else {
      styles = countryPickerStyles;
    }

    this.fuse = new Fuse(
      countryList.reduce(
        (acc, item) => [...acc, { id: item, name: this.getCountryName(countries[item]) }],
        [],
      ), {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: ['name'],
        id: 'id',
      }
    );
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.countryList !== this.props.countryList) {
      this.setState({
        m49List: nextProps.countryList,
        dataSource: ds.cloneWithRows(nextProps.countryList),
      });
    }
  }

  onSelectCountry(m49) {
    this.setState({
      modalVisible: false,
      filter: '',
      dataSource: ds.cloneWithRows(this.state.m49List),
    });

    this.props.onChange({
      m49,
      ...countries[m49],
      flag: undefined,
      name: this.getCountryName(countries[m49]),
    });
  }

  onClose() {
    this.setState({
      modalVisible: false,
      filter: '',
      dataSource: ds.cloneWithRows(this.state.m49List),
    });
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  getCountryName(country, optionalTranslation) {
    const translation = optionalTranslation || this.props.translation || 'en';
    return country.name[translation] || country.name.common;
  }

  setVisibleListHeight(offset) {
    this.visibleListHeight = getHeightPercent(100) - offset;
  }

  getLetters(list) {
    return Object.keys(list.reduce((acc, val) => ({
      ...acc,
      [this.getCountryName(countries[val]).slice(0, 1).toUpperCase()]: '',
    }), {})).sort();
  }

  openModal = this.openModal.bind(this);

  // dimensions of country list and window
  itemHeight = getHeightPercent(7);
  listHeight = countries.length * this.itemHeight;

  openModal() {
    this.setState({ modalVisible: true });
  }

  scrollTo(letter) {
    // find position of first country that starts with letter
    const index = this.state.m49List.map((country) => this.getCountryName(countries[country])[0])
      .indexOf(letter);
    if (index === -1) {
      return;
    }
    let position = index * this.itemHeight;

    // do not scroll past the end of the list
    if (position + this.visibleListHeight > this.listHeight) {
      position = this.listHeight - this.visibleListHeight;
    }

    // scroll
    this._listView.scrollTo({
      y: position,
    });
  }

  handleFilterChange = (value) => {
    const filteredCountries = value === '' ? this.state.m49List : this.fuse.search(value);

    this._listView.scrollTo({ y: 0 });

    this.setState({
      filter: value,
      dataSource: ds.cloneWithRows(filteredCountries),
    });
  }

  renderCountry(country, index) {
    return (
      <TouchableOpacity
        key={index}
        onPress={() => this.onSelectCountry(country)}
        activeOpacity={0.99}
      >
        {this.renderCountryDetail(country)}
      </TouchableOpacity>
    );
  }

  renderLetters(letter, index) {
    return (
      <TouchableOpacity
        key={index}
        onPress={() => this.scrollTo(letter)}
        activeOpacity={0.6}
      >
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  renderCountryDetail(m49) {
    const country = countries[m49];
    return (
      <View style={styles.itemCountry}>
        {CountryPicker.renderFlag(m49)}
        <View style={styles.itemCountryName}>
          <Text style={styles.countryName}>
            {this.getCountryName(country)}
          </Text>
        </View>
      </View>
    );
  }

  render() {
    return (
      <View>
        <TouchableOpacity
          disabled={this.props.disabled}    //to provide a functionality to disable/enable the onPress of Country Picker.
          onPress={() => this.setState({ modalVisible: true })}
          activeOpacity={0.7}
        >
          {
            this.props.children ?
              this.props.children
            :
              (<View style={styles.touchFlag}>
                {CountryPicker.renderFlag(this.props.m49)}
              </View>)
          }
        </TouchableOpacity>
        <Modal
          visible={this.state.modalVisible}
          onRequestClose={() => this.setState({ modalVisible: false })}
        >
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              {
                this.props.closeable &&
                  <CloseButton
                    onPress={() => this.onClose()}
                  />
              }
              {
                this.props.filterable &&
                  <TextInput
                    autoFocus={this.props.autoFocusFilter}
                    autoCorrect={false}
                    placeholder={this.props.filterPlaceholder}
                    placeholderTextColor={this.props.filterPlaceholderTextColor}
                    style={[styles.input, !this.props.closeable && styles.inputOnly]}
                    onChangeText={this.handleFilterChange}
                    value={this.state.filter}
                  />
              }
            </View>
            <KeyboardAvoidingView behavior="padding">
              <View style={styles.contentContainer}>
                <ListView
                  keyboardShouldPersistTaps="always"
                  enableEmptySections
                  ref={listView => this._listView = listView}
                  dataSource={this.state.dataSource}
                  renderRow={country => this.renderCountry(country)}
                  initialListSize={30}
                  pageSize={15}
                  onLayout={
                    (
                      { nativeEvent: { layout: { y: offset } } }
                    ) => this.setVisibleListHeight(offset)
                  }
                />
                <ScrollView
                  contentContainerStyle={styles.letters}
                  keyboardShouldPersistTaps="always"
                >
                  {
                    this.state.filter === '' &&
                    this.state.letters.map((letter, index) => this.renderLetters(letter, index))
                  }
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    );
  }
}
