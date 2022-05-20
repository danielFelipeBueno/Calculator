import 'package:calculator/redux/actions/calculator.actions.dart';
import 'package:calculator/redux/reducers/app.state.dart';

AppState appStateReducer(AppState prev, action){
  //todo reducers
  if (action is SetFirstnumber){
    return prev.copyWith(firstNumber: action.number);
  }
  //*state
  if (action is SetIsClean){
    return prev.copyWith(isClean: action.isClean);
  }
  if (action is SetListNumber){
    return prev.copyWith(listNumbers: action.numbers);
  }
  if (action is SetListOperator){
    return prev.copyWith(listOperators: action.operators);
  }
  return prev;
}