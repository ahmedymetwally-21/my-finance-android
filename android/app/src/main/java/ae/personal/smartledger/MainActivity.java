package ae.personal.smartledger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
