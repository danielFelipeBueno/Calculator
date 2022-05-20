import 'package:calculator/redux/actions/calculator.actions.dart';
import 'package:redux_saga/redux_saga.dart';

newNumber({action})sync*{
  //todo saga
  print('SAGA: NEW NUMBER');
}

newOperator({action})sync*{
  //todo saga
}

cleanDelete({action})sync*{
  //todo saga
}

equals({action})sync*{
  //todo saga
}

newNumberWatcher()sync*{
  yield TakeEvery(newNumber, pattern: NewNumber);
}

newOperatorWatcher()sync*{
  yield TakeEvery(newNumber, pattern: NewOperator);
}

cleanDeleteWatcher()sync*{
  yield TakeEvery(cleanDelete, pattern:CleanDelete);
}

equalsWatcher({action})sync*{
  yield TakeEvery(equals, pattern:Equals);
}