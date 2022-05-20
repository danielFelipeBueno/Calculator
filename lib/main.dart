import 'package:calculator/redux/reducers/app.state.dart';
import 'package:calculator/screens/calculator/calculator.screen.dart';
import 'package:calculator/screens/settings/settings.screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';
import 'package:redux/redux.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(MyApp(store: configureStore()));
}

class MyApp extends StatelessWidget {
  final Store<AppState> store;
  const MyApp({Key? key,required this.store}) : super(key: key);

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return StoreProvider<AppState>(
      store: store, 
      child: StoreBuilder<AppState>(
        builder: (context, store){
          return MaterialApp(
            theme: ThemeData(
              primarySwatch: Colors.lime
            ),
            debugShowCheckedModeBanner: false,
            // initialRoute: 'home',
            // routes: {
            //   'home'     : ( _ ) => CalculatorScreen(),
            //   'settings' : ( _ ) => SettingsScreen()
            // },
            onGenerateRoute: _getRoute,
          );
        }
      )
    );
  }
  Route _getRoute(RouteSettings settings) {
    switch (settings.name){
      case 'home':
        return _buildRoute(settings, CalculatorScreen());
      case 'settings':
        return _buildRoute(settings, SettingsScreen());
      default:
        return _buildRoute(settings, CalculatorScreen());
    }
  }
  MaterialPageRoute _buildRoute(RouteSettings settings, Widget builder) {
    return MaterialPageRoute(
      settings: settings,
      builder: (BuildContext context) => builder,
    );
  }
}

