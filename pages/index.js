import { deleteCookie, getCookie, setCookie } from "cookies-next";
import SplunkThemeProvider from "@splunk/themes/SplunkThemeProvider";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useState, useRef } from "react";
import User from "@splunk/react-icons/User";
import Monogram, { getInitials } from "@splunk/react-ui/Monogram";
import Error from "@splunk/react-icons/Error";
import Warning from "@splunk/react-icons/Warning";
import File from "@splunk/react-ui/File";
import List from "@splunk/react-ui/List";

import TabLayout from "@splunk/react-ui/TabLayout";
import InfoCircle from "@splunk/react-icons/InfoCircle";
import Success from "@splunk/react-icons/Success";
import ReportSearch from "@splunk/react-icons/ReportSearch";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AppInspectTags from "./components/AppInspectTags";
import AppinspectReportTab from "./components/AppinspectReportTab";
import Menu from "@splunk/react-ui/Menu";
import { useRouter } from "next/router";

const Modal = dynamic(() => import("@splunk/react-ui/Modal"), {
  ssr: false,
});
Modal.Header = dynamic(
  () => import("@splunk/react-ui/Modal").then((mod) => mod.Header),
  {
    ssr: false,
  }
);
Modal.Body = dynamic(
  () => import("@splunk/react-ui/Modal").then((mod) => mod.Body),
  {
    ssr: false,
  }
);
Modal.Footer = dynamic(
  () => import("@splunk/react-ui/Modal").then((mod) => mod.Footer),
  {
    ssr: false,
  }
);

const Popover = dynamic(() => import("@splunk/react-ui/Popover"), {
  ssr: false,
});

const Heading = dynamic(() => import("@splunk/react-ui/Heading"), {
  ssr: false,
});

const P = dynamic(() => import("@splunk/react-ui/Paragraph"), {
  ssr: false,
});

const Chip = dynamic(() => import("@splunk/react-ui/Chip"), {
  ssr: false,
});

const Message = dynamic(() => import("@splunk/react-ui/Message"), {
  ssr: false,
});

const Card = dynamic(() => import("@splunk/react-ui/Card"), {
  ssr: false,
});

const Button = dynamic(() => import("@splunk/react-ui/Button"), {
  ssr: false,
});

const Text = dynamic(() => import("@splunk/react-ui/Text"), {
  ssr: false,
});

const WaitSpinner = dynamic(() => import("@splunk/react-ui/WaitSpinner"), {
  ssr: false,
});

const Link = dynamic(() => import("@splunk/react-ui/Link"), {
  ssr: false,
});

const timer = (ms) => new Promise((response) => setTimeout(response, ms));

async function checkstatus(
  token,
  request_id,
  elapsed,
  setElapsed,
  setFinalReport,
  setIsValidating
) {
  var status = "";
  var elapsed = 0;
  var sleep_seconds = 1;
  while (true) {
    elapsed = elapsed + sleep_seconds;
    setElapsed(elapsed);

    //Now that we have a valid request ID, let's sleep and loop until our result is complete.
    status = await fetch("/api/getreportstatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        token: token,
        request_id: request_id,
      }),
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw res;
      })
      .then((json) => {
        return json;
      });

    if (status.status == "PROCESSING") {
      await timer(2000);
    }
    if (status.status == "SUCCESS") {
      console.log("Successfully processed App");
      fetch("/api/getreport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          token: token,
          request_id: request_id,
        }),
      })
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          throw res;
        })
        .then((json) => {
          setFinalReport(json);
          setIsValidating(false);
        });
      break;
    }
  }
  return status;
}

export default function Home() {
  const router = useRouter();
  const { request_id } = router.query;

  const modalToggle = useRef(null);
  const [open, setOpen] = useState(false);

  //Authentication
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState();
  const [loginError, setLoginError] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Popover
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [monogramAnchor, setMonogramAnchor] = useState();
  const monogramAnchorRef = useCallback((el) => setMonogramAnchor(el), []);

  const [token, setToken] = useState();

  //Get Final Report
  const [finalReport, setFinalReport] = useState({});

  //Process Status
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedTags, setSelectedTags] = useState(["cloud"]);
  const [file, setFile] = useState();

  // Dark mode detection
  const [theme, setMode] = useState("light");

  useEffect(() => {
    if (request_id) {
      setIsValidating(true);
      checkstatus(
        token,
        request_id,
        elapsedTime,
        setElapsedTime,
        setFinalReport,
        setIsValidating
      );
    }
  }, [request_id]);

  useEffect(() => {
    // setToken(getCookie("token"));

    // Add listener to update styles
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => setMode(e.matches ? "dark" : "light"));

    // Setup dark/light mode for the first time
    setMode(
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    );

    // Load token from cookie
    var cookieToken = getCookie("token");
    if (cookieToken) {
      try {
        var details = JSON.parse(
          Buffer.from(cookieToken.split(".")[1], "base64").toString()
        );
        setFullName(details["name"]);
        setToken(cookieToken);
      } catch {
        deleteCookie("token");
      }
    }

    // Remove listener
    return () => {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", () => {});
    };
  }, []);

  /* Authentication Functions */
  const updatePassword = (e) => {
    setPassword(e.target.value);
  };

  const updateUsername = (e) => {
    setUsername(e.target.value);
  };

  const login = (e) => {
    e.preventDefault();

    setIsLoggingIn(true);

    fetch("/api/authsplunkapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        username: username,
        password: password,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        setIsLoggingIn(false);

        if (data.data === undefined) {
          if (data.msg == "Failed to authenticate user") {
            setLoginError("Invalid Username or Password");
          } else {
            setLoginError(data.msg);
          }
        } else {
          //setCookie('token', data.data.token);
          setToken(data.data.token);
          setFullName(data.data.user.name);
          setCookie("token", data.data.token);
        }
      });
  };

  /* File Reader Functions */
  function loadFile(file) {
    const fileItem = { name: file.name };

    const fileReader = new FileReader();
    fileReader.onload = () => {
      fileItem.value = fileReader.result;
    };
    fileReader.readAsDataURL(file);

    return fileItem;
  }

  const handleAddFiles = (files) => {
    if (files.length > 0) {
      setFile(loadFile(files[0]));
      setUploadError(null);
    }
  };

  const handleRemoveFile = ({ index }) => {
    setFile(null);
    setUploadError(null);
  };

  const handleSelectTags = (e, { values }) => {
    setSelectedTags(values);
  };

  const logout = () => {
    setToken(null);
    setFullName(null);
    deleteCookie("token");
  };

  const handleRequestOpen = () => {
    setOpen(true);
  };

  const handleRequestClose = () => {
    setOpen(false);
  };

  /* Validation Functions */
  const validateApps = (e) => {
    fetch("/api/validateapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        token: token,
        value: file.value,
        filename: file.name,
        included_tags: selectedTags,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          return response.json();
        }

        var data = await response.json();
        throw data;
      })
      .then((data) => {
        router.query.request_id = data.request_id;
        router.push(router);
        if (data.request_id) {
          setIsValidating(true);
          checkstatus(
            token,
            data.request_id,
            elapsedTime,
            setElapsedTime,
            setFinalReport,
            setIsValidating
          );
        }
      })
      .catch((data) => {
        if (data.code == "Unauthorized") {
          setLoginError(data.description);
          logout();
        } else {
          setUploadError(data.message);
        }
      });
  };

  const refreshPage = (e) => {
    console.log("Refreshing");
    router.query.request_id = null;
    router.push(router);
    setElapsedTime(0);
    setIsLoggingIn(false);
    setIsValidating(false);
    setSelectedTags(["cloud"]);
    setFile(null);
    setFinalReport({});
  };

  const printDocument = (e) => {
    const input = document.getElementById("report");
    html2canvas(input).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      pdf.addImage(imgData, "JPEG", 0, 0);
      pdf.save("report.pdf");
    });
  };

  return (
    <SplunkThemeProvider
      family="prisma"
      colorScheme={theme}
      density="comfortable"
    >
      {fullName ? (
        <>
          <span
            style={{
              fontSize: "50px",
              marginLeft: "20px",
              verticalAlign: "middle",
              display: "inline-block",
            }}
          >
            <Monogram
              style={{
                margin: "10px",
              }}
              backgroundColor="auto"
              initials={getInitials(fullName)}
              onClick={() => setPopoverOpen(true)}
              elementRef={monogramAnchorRef}
            />{" "}
            <Popover
              open={popoverOpen}
              anchor={monogramAnchor}
              onRequestClose={() => setPopoverOpen(false)}
            >
              <Menu style={{ width: 200 }}>
                <Menu.Item disabled>{fullName}</Menu.Item>

                <Menu.Item onClick={() => logout()}>Sign-out</Menu.Item>
              </Menu>
            </Popover>
          </span>
        </>
      ) : (
        <></>
      )}
      <br />
      <div style={{ width: "100%" }}>
        <Heading
          style={{
            padding: "10px",
            paddingTop: "0px",
            marginTop: "0px",
            textAlign: "center",
            clear: "both",
          }}
          level={1}
        >
          Splunk Appinspect
        </Heading>
      </div>
      {!token ? (
        <>
          <div
            style={{ textAlign: "center", justify: "center", margin: "auto" }}
          >
            <img
              src="/wizard.svg"
              style={{ textAlign: "center", justify: "center", margin: "auto" }}
            ></img>
          </div>
          <P style={{ padding: "10px", textAlign: "center" }} level={2}>
            Are you ready to start validating your Splunk App for{" "}
            <Link target="_new" to="https://splunkbase.splunk.com">
              Splunkbase
            </Link>{" "}
            or{" "}
            <Link
              target="_new"
              to="https://www.splunk.com/en_us/products/splunk-cloud-platform.html"
            >
              Splunk Cloud Platform
            </Link>
            ? This is the place for you.
          </P>
        </>
      ) : (
        <></>
      )}
      {!isValidating ? (
        <>
          {!token ? (
            <div style={{ width: "100%", display: "block" }}>
              <div style={{ margin: "auto", textAlign: "center" }}>
                <Heading
                  level={2}
                  style={{ margin: "auto", textAlign: "center" }}
                >
                  Enter Your Username and Password for Splunk.com
                </Heading>
                <br />
                {loginError ? (
                  <>
                    <SplunkThemeProvider
                      family="enterprise"
                      colorScheme={theme}
                      density="compact"
                    >
                      <Message
                        appearance="fill"
                        style={{
                          margin: "auto",
                          width: "50%",
                        }}
                        type="error"
                      >
                        {loginError}
                      </Message>
                    </SplunkThemeProvider>
                    <br />
                  </>
                ) : (
                  <></>
                )}
                <form onSubmit={(e) => login(e)}>
                  <Text
                    value={username}
                    onChange={(e) => updateUsername(e)}
                    startAdornment={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "0 8px",
                        }}
                      >
                        <User size={1} />
                      </div>
                    }
                    inline
                    placeholder="Username"
                  />
                  <Text
                    inline
                    type="password"
                    value={password}
                    placeholder="Password"
                    onChange={(e) => updatePassword(e)}
                  />
                  <br />
                  <br />
                  <br />
                  {isLoggingIn ? (
                    <>
                      <WaitSpinner size="large" />
                    </>
                  ) : (
                    <>
                      <Button
                        inline={false}
                        style={{
                          marginBottom: "10px",
                          width: "25%",
                          textAlign: "center",
                          margin: "auto",
                        }}
                        appearance="primary"
                        label="Login"
                        type="submit"
                      />{" "}
                    </>
                  )}
                </form>
              </div>
            </div>
          ) : (
            <></>
          )}

          <>
            <br />
            {token && finalReport.reports == undefined ? (
              <>
                <AppInspectTags
                  style={{ textAlign: "center" }}
                  selector={handleSelectTags}
                  selectedTags={selectedTags}
                ></AppInspectTags>
                {uploadError ? (
                  <>
                    <SplunkThemeProvider
                      family="enterprise"
                      colorScheme={theme}
                      density="comfortable"
                    >
                      <Message
                        appearance="fill"
                        type="error"
                        style={{
                          marginLeft: "auto",
                          marginRight: "auto",
                          padding: "auto",
                          textAlign: "center",
                          width: "30%",
                        }}
                      >
                        {uploadError}
                      </Message>
                    </SplunkThemeProvider>
                  </>
                ) : (
                  <></>
                )}
                <div
                  style={{
                    width: "50%",
                    textAlign: "center",
                    justifyContent: "center",
                    margin: "auto",
                  }}
                >
                  <div style={{ width: "100%", display: "block" }}>
                    <File
                      onRequestAdd={handleAddFiles}
                      onRequestRemove={handleRemoveFile}
                      error={uploadError !== null ? true : false}
                      supportsMessage={
                        <>
                          Supports the following Splunk App file types: .gz,
                          .tgz, .zip, .spl, .tar
                        </>
                      }
                      style={{
                        width: "50%",
                        textAlign: "center",
                        justifyContent: "center",
                        margin: "auto",
                      }}
                      help={
                        <>
                          Learn more about{" "}
                          <Link
                            target="_new"
                            to="https://dev.splunk.com/enterprise/reference/appinspect/appinspectapiepref#Splunk-AppInspect-API"
                          >
                            Splunk App File Types
                          </Link>
                        </>
                      }

                      // allowMultiple
                    >
                      {file ? (
                        <File.Item
                          name={file.name}
                          error={uploadError !== null ? true : false}
                          style={{
                            textAlign: "center",
                            justifyContent: "center",
                            margin: "auto",
                          }}
                        />
                      ) : (
                        <></>
                      )}
                      {/* {filesArray.map((key) => {
                      return <p key={key}>{key.name}</p>;
                    })} */}
                    </File>
                  </div>
                </div>{" "}
                <div style={{ textAlign: "center" }}>
                  <P style={{ textAlign: "center" }}>
                    Learn more about{" "}
                    <Link
                      target="_new"
                      to="https://dev.splunk.com/enterprise/reference/appinspect/appinspectapiepref#Splunk-AppInspect-API"
                    >
                      Splunk App File Types
                    </Link>
                  </P>
                </div>
                <br />
                <Button
                  inline={false}
                  style={{
                    marginBottom: "10px",
                    width: "25%",
                    textAlign: "center",
                    margin: "auto",
                  }}
                  appearance="primary"
                  label="Validate App(s)"
                  type="submit"
                  onClick={validateApps}
                />{" "}
              </>
            ) : (
              <></>
            )}

            {finalReport.reports !== undefined ? (
              <div style={{ textAlign: "center", margin: "auto" }}>
                <P style={{ textAlign: "center" }}>
                  Thank you for inspecting your app! Come back any time to view
                  your report:
                </P>
                <Link
                  to={
                    "https://appinspect-ui.vercel.app/?request_id=" + request_id
                  }
                >
                  {"https://appinspect-ui.vercel.app/?request_id=" + request_id}
                </Link>
                <br />
                <br />

                <Button onClick={(e) => refreshPage(e)}>
                  Ready to upload another app?
                </Button>
                <br />
                <div id="report" style={{ marginTop: 75 }}>
                  <Heading
                    style={{ textAlign: "center", margin: "auto" }}
                    level={1}
                  >
                    {finalReport.reports[0].app_name}
                  </Heading>
                  <Heading
                    style={{ textAlign: "center", margin: "auto" }}
                    level={2}
                  >
                    {finalReport.reports[0].app_description}
                  </Heading>
                  <TabLayout
                    style={{
                      width: "75%",
                      textAlign: "center",
                      justify: "center",
                      margin: "auto",
                    }}
                    defaultActivePanelId="info"
                  >
                    <TabLayout.Panel
                      label="App Info"
                      panelId="info"
                      style={{
                        textAlign: "center",
                        justify: "center",
                        margin: "auto",
                      }}
                    >
                      <Card
                        minWidth="100%"
                        style={{
                          textAlign: "center",
                          justify: "center",
                          margin: "auto",
                        }}
                      >
                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Author
                        </Heading>
                        <p>{finalReport.reports[0].app_author}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Version
                        </Heading>
                        <p>{finalReport.reports[0].app_version}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Hash
                        </Heading>
                        <p>{finalReport.reports[0].app_hash}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          AppInspect Request ID
                        </Heading>
                        <p>{finalReport.reports[0].request_id}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Run Time
                        </Heading>
                        <p>{finalReport.reports[0].metrics.start_time}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Execution Time
                        </Heading>
                        <p>
                          {Date(finalReport.reports[0].metrics.execution_time)}
                        </p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          AppInspect Version
                        </Heading>
                        <p>{finalReport.run_parameters.appinspect_version}</p>

                        <Heading
                          level={3}
                          style={{
                            textAlign: "center",
                            justify: "center",
                            margin: "auto",
                          }}
                        >
                          Included Tags
                        </Heading>
                        <div>
                          {finalReport.run_parameters.included_tags.map(
                            (tag, key) => (
                              <Chip key={key}>{tag}</Chip>
                            )
                          )}
                        </div>
                      </Card>
                    </TabLayout.Panel>

                    <AppinspectReportTab
                      icon={<Error style={{ color: "#A80000" }} />}
                      disabled={finalReport.summary.error == 0 ? true : false}
                      count={finalReport.summary.error}
                      label={"Errors - " + String(finalReport.summary.error)}
                      panelId="error"
                      check_result="error"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<Error style={{ color: "#A80000" }} />}
                      disabled={finalReport.summary.failure == 0 ? true : false}
                      count={finalReport.summary.failure}
                      label={
                        "Failures - " + String(finalReport.summary.failure)
                      }
                      panelId="failure"
                      check_result="failure"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<Warning style={{ color: "#A05F04" }} />}
                      disabled={
                        finalReport.summary.manual_check == 0 ? true : false
                      }
                      count={finalReport.summary.manual_check}
                      label={
                        "Manual Checks - " +
                        String(finalReport.summary.manual_check)
                      }
                      panelId="manual_check"
                      check_result="manual_check"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<Warning style={{ color: "#A05F04" }} />}
                      disabled={finalReport.summary.warning == 0 ? true : false}
                      count={finalReport.summary.warning}
                      label={"Warning - " + String(finalReport.summary.warning)}
                      panelId="warning"
                      check_result="warning"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<InfoCircle style={{ color: "#004FA8" }} />}
                      disabled={
                        finalReport.summary.not_applicable == 0 ? true : false
                      }
                      count={finalReport.summary.not_applicable}
                      label={
                        "Not Applicable - " +
                        String(finalReport.summary.not_applicable)
                      }
                      panelId="not_applicable"
                      check_result="not_applicable"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<InfoCircle style={{ color: "#004FA8" }} />}
                      disabled={finalReport.summary.skipped == 0 ? true : false}
                      count={finalReport.summary.skipped}
                      label={"Skipped - " + String(finalReport.summary.skipped)}
                      panelId="skipped"
                      check_result="skipped"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>

                    <AppinspectReportTab
                      icon={<Success style={{ color: "#407A06" }} />}
                      disabled={finalReport.summary.success == 0 ? true : false}
                      count={finalReport.summary.success}
                      label={
                        "Successes - " + String(finalReport.summary.success)
                      }
                      panelId="success"
                      check_result="success"
                      finalreport_groups={finalReport.reports[0].groups}
                    ></AppinspectReportTab>
                  </TabLayout>
                </div>
              </div>
            ) : (
              <></>
            )}
          </>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", margin: "auto" }}>
            <Heading style={{ textAlign: "center", margin: "auto" }} level={2}>
              Validating Splunk App
            </Heading>
            <p>Elapsed Time: {elapsedTime} Seconds</p>
            <WaitSpinner size="large" />
          </div>
        </>
      )}
      <br />
      <div style={{ textAlign: "center" }}>
        <Link ref={modalToggle} onClick={() => handleRequestOpen()}>
          <ReportSearch size={1} /> More Developer Resources
        </Link>
      </div>
      <Modal
        onRequestClose={() => handleRequestClose()}
        open={open}
        style={{ width: "600px" }}
      >
        <Modal.Header
          title="More Developer Resources"
          onRequestClose={handleRequestClose}
        />
        <Modal.Body>
          <List>
            <List.Item>
              <Link to="https://www.splunk.com/en_us/form/scde.html">
                Splunk Cloud Developer Edition
              </Link>
            </List.Item>
            <List.Item>
              <Link to="https://dev.splunk.com/">Splunk Developer Docs</Link>
            </List.Item>
          </List>
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance="primary"
            onClick={handleRequestClose}
            label="OK"
          />
        </Modal.Footer>
      </Modal>{" "}
      <br />
      <P style={{ margin: "auto", textAlign: "center" }} level={4}>
        © Copyright 2022 Splunk, Inc.
      </P>
    </SplunkThemeProvider>
  );
}
