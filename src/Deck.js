import React, { Component } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Dimensions,
  LayoutAnimation,
  UIManager
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;
const SWIPE_OUT_DURATION = 250;

class Deck extends Component {
  static defaultProps = {
    onSwipeRight: () => {},
    onSwipeLeft: () => {}
  }

  constructor(props) {
    super(props);

    const position = new Animated.ValueXY();

    // onStartShouldSetPanResponder gets called any time the user presses the given component
    //  if it returns true, then this instance of panResponder will be responsible for
    //  handling that gesture (you can have multiple instances per app)
    //  For example, if you simply always return true, then any time the user
    //  touches this component it will activate this responder
    //  You can also return false if you want to ignore certain actions
    // onPanResponderMove is called whenever a user starts to move the component
    //  around the screen (drag) - it is called many many times throughout a move
    // onPanResponderRelease is called whenever a user releases a drag
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gesture) => {
        console.log(gesture);
        // see panResponder docs:
        // dx / dy are the change in x and y (total distance travelled since the gesture started)
        // moveX and moveY are the latest screen coordinates
        // x0 and y0 seem to be the initial coordinates of the 'touch' ('responder grant')
        // vx and vy are the speed of the gesture (velocity)
        // numberActiveTouches indicates whether it is a single finger touch or multiple


        // 'position' does not need to exist on the state, and by updated the
        // value manually here (instead of using setState) we are mutating the
        // value without using the recommended rules for mutating state
        // HOWEVER, the docs show panResponder and position to exist on the // state object, so that is why we are doing it here.
        // We could also just let it exist on the object - this.panResponder and
        // this.position, but that is now how the docs for panResponder and
        // Animated do it
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (event, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          this.forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          this.forceSwipe('left');
        } else {
          this.resetPosition();
        }
      }
    });

    // index is a pointer to the piece of data that should currently be at the
    //   top of the list (and the first card to be rendered)
    this.state = { panResponder, position, index: 0 };
  }

  // deprecated
  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.data !== this.props.data) {
      this.setState({ index: 0 });
    }
  }

  // hacky alternative to componentWillReceiveProps is to set the 'data' prop
  // onto the state and check like this:
  //static getDerivedStateFromProps(nextProps, prevState) {
  //  if (nextProps.data !== prevState.data) {
  //    return { index: 0 };
  //  }
  //  return null;
  //}

  componentDidUpdate() {
    UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);
    LayoutAnimation.spring();
  }

  forceSwipe(direction) {
    const x = direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH;

    // .start() can take a callback to be executed after the animation is complete
    Animated.timing(this.state.position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION
    }).start(() => this.onSwipeComplete(direction));
  }

  onSwipeComplete(direction) {
    const { onSwipeLeft, onSwipeRight, data } = this.props;
    // this.state.index refers to the index of the record in props.data that we
    //  are currently swiping (the 'top' card that is currently rendered)
    const item = data[this.state.index];

    if (direction === 'right') {
      onSwipeRight(item);
    } else {
      onSwipeLeft(item);
    }
    // if we don't reset the position's value to 0,0 then when we apply the
    //  Animated.View to the next card (and the position via the style prop)
    //  it will start in the location that this card is in (far off screen)
    // Note also, again, that mutating the existing state of
    //  this.state.position is weird, but it is what they do in the docs :shrug:
    this.state.position.setValue({ x: 0, y: 0 });
    this.setState({ index: this.state.index + 1 });
  }

  resetPosition() {
    Animated.spring(this.state.position, {
      toValue: { x: 0, y: 0 }
    }).start();
  }

  getCardStyle() {
    // using interpolation to determine rotation:
    const { position } = this.state;
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-120deg', '0deg', '120deg']
    });

    //console.log({ positionLayout: this.state.position.getLayout() });

    // The 'style' prop that Animated.View takes is a bit special in that if it
    //  is passed position.getLayout() it watches for changes to that object and
    //  re-renders when it sees those changes
    // In other words, it is a re-render that happens outside of the normal
    //  react setState workflow and also outside of the react-redux
    //  mapStateToProps workflow
    return {
      ...this.state.position.getLayout(),
      transform: [{ rotate }]
    };
  }

  renderCards() {
    // this.state.index is a pointer to the piece of data that we want to be
    //   the top card, anything before that is ignored

    // If there are no cards left to render:
    if (this.state.index >= this.props.data.length) {
      return this.props.renderNoMoreCards();
    }

    return this.props.data.map((item, dataIndex) => {
      // If we are not yet to the first piece of data that we want to be rendered
      if (dataIndex < this.state.index) { return null; }

      // if we are on the first piece of data that we want to be rendered
      if (dataIndex === this.state.index) {
        return (
          <Animated.View
          key={item.id}
          style={[this.getCardStyle(), styles.cardStyle, { elevation: 1 }]}
          {...this.state.panResponder.panHandlers}
          >
            {this.props.renderCard(item)}
          </Animated.View>
        );
      }

      // We use an Animated.View here because a regular View will have to
      //  re-render the image when it is 'promoted' to an Animated.View (when the
      //  card on top of it is swiped out), thus causing a flash
      // Because we do not pass in the panHandlers or position.getLayout these
      //  are not animated until we swipe the top card and 'promote' the next
      //  card to being the top card
      return (
        <Animated.View
          key={item.id}
          style={[styles.cardStyle, { top: 10 * (dataIndex - this.state.index) }]}
        >
          {this.props.renderCard(item)}
        </Animated.View>
      );
    }).reverse();
  }

  render() {
    return (
      <View>
        {this.renderCards()}
      </View>
    );
  }
}

// position absolute stacks the cards on top of each other
// when position absolute is used, it causes the cards to collaps to the content
//   contained within each, so we will have to manually set the width
const styles = {
  cardStyle: {
    position: 'absolute',
    width: SCREEN_WIDTH
  }
};

export default Deck;
