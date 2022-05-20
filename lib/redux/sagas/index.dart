

import 'package:calculator/redux/sagas/calculadot.sagas.dart';
import 'package:redux_saga/redux_saga.dart';

rootSaga()sync*{
  yield All({
    #newNumber: Fork(newNumberWatcher()),
    #newOperator: Fork(newOperatorWatcher()),
    #cleanDelete: Fork(cleanDeleteWatcher()),
    #equals: Fork(equalsWatcher())
  });
}