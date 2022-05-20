
import 'package:calculator/redux/reducers/app.state.dart';
import 'package:calculator/screens/calculator/widgets.dart';
import 'package:calculator/ui/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';

class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({Key? key}) : super(key: key);

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  @override
  void initState() {
    super.initState();
  }
  @override
  Widget build(BuildContext context) {
    double sizeBox = MediaQuery.of(context).size.width/4.8;
    return StoreConnector<AppState,AppState>(
      converter: (store)=> store.state,
      builder: (context, state){
        return Scaffold(
          body: Column(
            children: [
              Expanded(
                flex: 1,
                child: Container()
              ),
              const Expanded(
                flex: 4,
                child: BigBox()
              ),
              Expanded(
                flex:8,
                child: NumberPad(sizeBox: sizeBox),
              )
            ],
          )
        );
      },
    );
  }
}







