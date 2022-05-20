
import 'package:calculator/redux/reducers/app.state.reducer.dart';
import 'package:calculator/redux/sagas/index.dart';
import 'package:redux/redux.dart';
import 'package:redux_saga/redux_saga.dart';

var sagaMiddleware = createSagaMiddleware();

final store = Store<AppState>(
  appStateReducer,
  initialState: AppState.initial(),
  middleware: [
    applyMiddleware(sagaMiddleware),
  ]
);

class AppState {
  final String firstNumber;
  final String secondNumber;
  //*state
  final List listOperators;
  final List listNumbers;
  final bool isClean;
  AppState({
    required this.firstNumber,
    required this.secondNumber,
    //*state
    required this.listOperators,
    required this.listNumbers,
    required this.isClean
  });
  factory AppState.initial(){
    return AppState(
      firstNumber: '',
      secondNumber: '',
      //*state
      listOperators:[],
      listNumbers:[],
      isClean: true
    );
  }
  AppState copyWith({
    String? firstNumber,
    String? secondNumber,
    //*state
    List? listOperators,
    List? listNumbers,
    bool? isClean
  }){
    return AppState(
      firstNumber: firstNumber ?? this.firstNumber,
      secondNumber: secondNumber ?? this.secondNumber,
      //*state 
      listOperators: listOperators ?? this.listOperators,
      listNumbers: listNumbers ?? this.listNumbers,
      isClean: isClean ?? this.isClean,
    );
  }
}

Store<AppState> configureStore() {
  sagaMiddleware.setStore(store);

  sagaMiddleware.run(rootSaga);

  return store;
}